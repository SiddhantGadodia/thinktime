// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ThinkTimeAds} from "../src/ThinkTimeAds.sol";

contract Rejector {
    bool public accept;

    function setAccept(bool a) external {
        accept = a;
    }

    function doClaim(ThinkTimeAds ads) external {
        ads.claim();
    }

    receive() external payable {
        require(accept, "no");
    }
}

contract ThinkTimeAdsTest is Test {
    ThinkTimeAds ads;
    address owner = address(this);
    address attestor = makeAddr("attestor");
    address treasury = makeAddr("treasury");
    address sponsor = makeAddr("sponsor");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    uint256 constant RATE = 0.001 ether;

    function setUp() public {
        ads = new ThinkTimeAds(attestor, treasury);
        vm.deal(sponsor, 100 ether);
    }

    function _create() internal returns (uint256 id) {
        vm.prank(sponsor);
        id = ads.createCampaign{value: 1 ether}("Kernel Coffee", "coding", RATE);
    }

    function _pay(uint256 id, address[] memory u, uint32[] memory v, bytes32 b) internal {
        vm.prank(attestor);
        ads.payoutBatch(id, u, v, b);
    }

    function _one(address a, uint32 n) internal pure returns (address[] memory u, uint32[] memory v) {
        u = new address[](1);
        v = new uint32[](1);
        u[0] = a;
        v[0] = n;
    }

    function test_createTopUpClose() public {
        uint256 id = _create();
        assertEq(id, 0);
        ThinkTimeAds.Campaign memory c = ads.getCampaign(id);
        assertEq(c.remaining, 1 ether);
        assertTrue(c.active);

        vm.prank(sponsor);
        ads.topUp{value: 0.5 ether}(id);
        assertEq(ads.getCampaign(id).remaining, 1.5 ether);

        uint256 before = sponsor.balance;
        vm.prank(sponsor);
        ads.closeCampaign(id);
        assertEq(sponsor.balance - before, 1.5 ether);
        assertFalse(ads.getCampaign(id).active);
    }

    function test_createReverts() public {
        vm.startPrank(sponsor);
        vm.expectRevert(ThinkTimeAds.ZeroValue.selector);
        ads.createCampaign("x", "y", RATE);
        vm.expectRevert(ThinkTimeAds.ZeroRate.selector);
        ads.createCampaign{value: 1 ether}("x", "y", 0);
        vm.stopPrank();
    }

    function test_nonSponsorCannotClose() public {
        uint256 id = _create();
        vm.prank(bob);
        vm.expectRevert(ThinkTimeAds.NotSponsor.selector);
        ads.closeCampaign(id);
        vm.deal(carol, 1 ether);
        vm.prank(carol);
        vm.expectRevert(ThinkTimeAds.NotSponsor.selector);
        ads.topUp{value: 1}(id);
    }

    function test_payoutOnlyAttestor() public {
        uint256 id = _create();
        (address[] memory u, uint32[] memory v) = _one(alice, 1);
        vm.prank(bob);
        vm.expectRevert(ThinkTimeAds.NotAttestor.selector);
        ads.payoutBatch(id, u, v, keccak256("b"));
    }

    function test_feeSplitMath() public {
        uint256 id = _create();
        address[] memory u = new address[](2);
        uint32[] memory v = new uint32[](2);
        u[0] = alice; v[0] = 10;
        u[1] = bob; v[1] = 5;
        _pay(id, u, v, keccak256("b1"));

        // 10 views * 0.001 = 0.01 -> 70% = 0.007 ; 5 views -> 0.0035
        assertEq(alice.balance, 0.007 ether);
        assertEq(bob.balance, 0.0035 ether);
        assertEq(treasury.balance, 0.015 ether - 0.0105 ether);
        ThinkTimeAds.Campaign memory c = ads.getCampaign(id);
        assertEq(c.remaining, 1 ether - 0.015 ether);
        assertEq(c.totalViews, 15);
        assertEq(c.totalPaid, 0.015 ether);
    }

    function test_batchReplayRejected() public {
        uint256 id = _create();
        (address[] memory u, uint32[] memory v) = _one(alice, 1);
        _pay(id, u, v, keccak256("b"));
        vm.prank(attestor);
        vm.expectRevert(ThinkTimeAds.BatchAlreadySettled.selector);
        ads.payoutBatch(id, u, v, keccak256("b"));
    }

    function test_overBudgetRejected() public {
        uint256 id = _create();
        (address[] memory u, uint32[] memory v) = _one(alice, 1001); // 1.001 ether > 1
        vm.prank(attestor);
        vm.expectRevert(ThinkTimeAds.OverBudget.selector);
        ads.payoutBatch(id, u, v, keccak256("b"));
    }

    function test_lengthMismatchAndInactive() public {
        uint256 id = _create();
        address[] memory u = new address[](2);
        uint32[] memory v = new uint32[](1);
        vm.prank(attestor);
        vm.expectRevert(ThinkTimeAds.LengthMismatch.selector);
        ads.payoutBatch(id, u, v, keccak256("a"));

        vm.prank(sponsor);
        ads.closeCampaign(id);
        (address[] memory u1, uint32[] memory v1) = _one(alice, 1);
        vm.prank(attestor);
        vm.expectRevert(ThinkTimeAds.InactiveCampaign.selector);
        ads.payoutBatch(id, u1, v1, keccak256("b"));
    }

    function test_failedTransferGoesToClaimable() public {
        uint256 id = _create();
        Rejector r = new Rejector();
        (address[] memory u, uint32[] memory v) = _one(address(r), 10);
        _pay(id, u, v, keccak256("b"));
        assertEq(address(r).balance, 0);
        assertEq(ads.claimable(address(r)), 0.007 ether);

        r.setAccept(true);
        r.doClaim(ads);
        assertEq(address(r).balance, 0.007 ether);
        assertEq(ads.claimable(address(r)), 0);

        vm.expectRevert(ThinkTimeAds.NothingToClaim.selector);
        r.doClaim(ads);
    }

    function test_adminSetters() public {
        ads.setFee(5000);
        vm.expectRevert(ThinkTimeAds.FeeTooHigh.selector);
        ads.setFee(5001);
        vm.prank(bob);
        vm.expectRevert(ThinkTimeAds.NotOwner.selector);
        ads.setFee(100);
        ads.setAttestor(bob);
        ads.setTreasury(bob);
        assertEq(ads.attestor(), bob);
        assertEq(ads.treasury(), bob);
    }
}
