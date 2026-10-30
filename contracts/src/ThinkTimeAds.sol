// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ThinkTimeAds
/// @notice Sponsor escrow for ThinkTime. Sponsors fund campaigns with native MON; the
///         attestor settles batches of verified views and users receive (1 - fee) of each view's rate.
///         NOTE: view attestation is trusted (off-chain). The contract only guarantees that
///         payouts can never exceed a campaign's escrowed budget and can never be replayed.
contract ThinkTimeAds {
    struct Campaign {
        address sponsor;
        string name;
        string category;
        uint256 ratePerView;
        uint256 remaining;
        uint256 totalViews;
        uint256 totalPaid;
        bool active;
    }

    error NotOwner();
    error NotAttestor();
    error NotSponsor();
    error ZeroValue();
    error ZeroRate();
    error ZeroAddress();
    error InactiveCampaign();
    error UnknownCampaign();
    error BatchAlreadySettled();
    error LengthMismatch();
    error OverBudget();
    error FeeTooHigh();
    error NothingToClaim();
    error TransferFailed();
    error Reentrancy();

    uint256 public constant MAX_FEE_BPS = 5000;

    address public owner;
    address public attestor;
    address public treasury;
    uint256 public platformFeeBps = 3000;
    uint256 public nextCampaignId;

    mapping(uint256 => Campaign) private campaigns;
    mapping(bytes32 => bool) public settledBatches;
    mapping(address => uint256) public claimable;

    uint256 private _lock = 1;

    event CampaignCreated(uint256 indexed id, address indexed sponsor, string name, string category, uint256 ratePerView, uint256 budget);
    event CampaignToppedUp(uint256 indexed id, uint256 amount);
    event CampaignClosed(uint256 indexed id, uint256 refunded);
    event ViewsPaid(uint256 indexed campaignId, address indexed user, uint32 views, uint256 userAmount);
    event BatchSettled(uint256 indexed campaignId, bytes32 indexed batchId, uint256 totalViews, uint256 totalCost);
    event Claimed(address indexed user, uint256 amount);
    event PayoutDeferred(address indexed user, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(address _attestor, address _treasury) {
        if (_attestor == address(0) || _treasury == address(0)) revert ZeroAddress();
        owner = msg.sender;
        attestor = _attestor;
        treasury = _treasury;
    }

    // ---------------------------------------------------------------- sponsors

    function createCampaign(string calldata name, string calldata category, uint256 ratePerView)
        external
        payable
        returns (uint256 id)
    {
        if (msg.value == 0) revert ZeroValue();
        if (ratePerView == 0) revert ZeroRate();
        id = nextCampaignId++;
        campaigns[id] = Campaign({
            sponsor: msg.sender,
            name: name,
            category: category,
            ratePerView: ratePerView,
            remaining: msg.value,
            totalViews: 0,
            totalPaid: 0,
            active: true
        });
        emit CampaignCreated(id, msg.sender, name, category, ratePerView, msg.value);
    }

    function topUp(uint256 id) external payable {
        Campaign storage c = _get(id);
        if (msg.sender != c.sponsor) revert NotSponsor();
        if (msg.value == 0) revert ZeroValue();
        c.remaining += msg.value;
        emit CampaignToppedUp(id, msg.value);
    }

    function closeCampaign(uint256 id) external nonReentrant {
        Campaign storage c = _get(id);
        if (msg.sender != c.sponsor) revert NotSponsor();
        uint256 refund = c.remaining;
        c.active = false;
        c.remaining = 0;
        emit CampaignClosed(id, refund);
        if (refund > 0) {
            (bool ok,) = c.sponsor.call{value: refund}("");
            if (!ok) revert TransferFailed();
        }
    }

    // ---------------------------------------------------------------- settlement

    function payoutBatch(uint256 campaignId, address[] calldata users, uint32[] calldata viewCounts, bytes32 batchId)
        external
        nonReentrant
    {
        if (msg.sender != attestor) revert NotAttestor();
        if (settledBatches[batchId]) revert BatchAlreadySettled();
        if (users.length != viewCounts.length) revert LengthMismatch();
        Campaign storage c = _get(campaignId);
        if (!c.active) revert InactiveCampaign();

        // effects
        settledBatches[batchId] = true;

        uint256 rate = c.ratePerView;
        uint256 feeBps = platformFeeBps;
        uint256 totalViews;
        uint256 totalCost;
        uint256 treasuryAmt;
        uint256[] memory userAmts = new uint256[](users.length);

        for (uint256 i; i < users.length; ++i) {
            uint256 amount = uint256(viewCounts[i]) * rate;
            uint256 userAmt = (amount * (10000 - feeBps)) / 10000;
            userAmts[i] = userAmt;
            treasuryAmt += amount - userAmt;
            totalViews += viewCounts[i];
            totalCost += amount;
        }
        if (totalCost > c.remaining) revert OverBudget();
        c.remaining -= totalCost;
        c.totalViews += totalViews;
        c.totalPaid += totalCost;

        // interactions
        for (uint256 i; i < users.length; ++i) {
            _pushOrDefer(users[i], userAmts[i]);
            emit ViewsPaid(campaignId, users[i], viewCounts[i], userAmts[i]);
        }
        _pushOrDefer(treasury, treasuryAmt);
        emit BatchSettled(campaignId, batchId, totalViews, totalCost);
    }

    function _pushOrDefer(address to, uint256 amt) private {
        if (amt == 0) return;
        (bool ok,) = to.call{value: amt}("");
        if (!ok) {
            claimable[to] += amt;
            emit PayoutDeferred(to, amt);
        }
    }

    function claim() external nonReentrant {
        uint256 amt = claimable[msg.sender];
        if (amt == 0) revert NothingToClaim();
        claimable[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amt}("");
        if (!ok) revert TransferFailed();
        emit Claimed(msg.sender, amt);
    }

    // ---------------------------------------------------------------- admin

    function setAttestor(address a) external onlyOwner {
        if (a == address(0)) revert ZeroAddress();
        attestor = a;
    }

    function setTreasury(address t) external onlyOwner {
        if (t == address(0)) revert ZeroAddress();
        treasury = t;
    }

    function setFee(uint256 bps) external onlyOwner {
        if (bps > MAX_FEE_BPS) revert FeeTooHigh();
        platformFeeBps = bps;
    }

    // ---------------------------------------------------------------- views

    function getCampaign(uint256 id) external view returns (Campaign memory) {
        if (id >= nextCampaignId) revert UnknownCampaign();
        return campaigns[id];
    }

    function _get(uint256 id) private view returns (Campaign storage) {
        if (id >= nextCampaignId) revert UnknownCampaign();
        return campaigns[id];
    }
}

