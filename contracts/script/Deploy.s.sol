// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ThinkTimeAds} from "../src/ThinkTimeAds.sol";

/// forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --private-key $PRIVATE_KEY
/// The deployer is the owner, attestor and treasury (single-key hackathon setup).
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        ThinkTimeAds ads = new ThinkTimeAds(msg.sender, msg.sender);
        vm.stopBroadcast();
        console.log("ThinkTimeAds deployed at:", address(ads));
    }
}
