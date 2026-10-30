// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ThinkTimeAds} from "../src/ThinkTimeAds.sol";

/// CONTRACT_ADDRESS=0x... forge script script/Seed.s.sol --rpc-url monad_testnet --broadcast --private-key $PRIVATE_KEY
/// Needs ~2 MON + gas. Campaign ids 0..3 must match web/lib/ads.ts.
contract Seed is Script {
    function run() external {
        ThinkTimeAds ads = ThinkTimeAds(vm.envAddress("CONTRACT_ADDRESS"));
        string[4] memory names = ["Kernel Coffee", "NoteNest", "Driftway", "Ledgerly"];
        string[4] memory cats = ["coding", "study", "travel", "finance"];
        // default 0.5 MON per campaign; override with SEED_BUDGET_WEI if your key holds less
        uint256 budget = vm.envOr("SEED_BUDGET_WEI", uint256(0.5 ether));
        vm.startBroadcast();
        for (uint256 i; i < 4; ++i) {
            uint256 id = ads.createCampaign{value: budget}(names[i], cats[i], 0.001 ether);
            console.log("campaign", id, names[i]);
        }
        vm.stopBroadcast();
    }
}
