const hre = require("hardhat");
const fs = require("fs");
const {fromE18, fromOvnGov, toUSDC, fromUSDC} = require("../utils/decimals");
const {expect} = require("chai");
const {initWallet} = require("../utils/network");
const ethers = hre.ethers;


let UsdPlusToken = JSON.parse(fs.readFileSync('./abi/UsdPlusToken.json'));
let OvnGovernor = JSON.parse(fs.readFileSync('./abi/OvnGovernor.json'));
let OvnToken = JSON.parse(fs.readFileSync('./abi/OvnToken.json'));


const proposalStates = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed'];


async function main() {

    let wallet = await initWallet(ethers);

    let usdPlus = await ethers.getContractAt(UsdPlusToken.abi, UsdPlusToken.address, wallet);
    let governor = await ethers.getContractAt(OvnGovernor.abi, OvnGovernor.address);
    let ovn = await ethers.getContractAt(OvnToken.abi, OvnToken.address);

    let addresses = [];
    let values = [];
    let abis = [];


    addresses.push(usdPlus.address);
    values.push(0);
    abis.push(usdPlus.interface.encodeFunctionData('grantRole', [await usdPlus.EXCHANGER(), wallet.address]))


    console.log('Creating a proposal...')
    const proposeTx = await governor.proposeExec(
        addresses,
        values,
        abis,
        ethers.utils.id("Proposal #22 New core"),
    );

    console.log('Tx ' + proposeTx.hash);
    let tx = await proposeTx.wait();
    const proposalId = tx.events.find((e) => e.event == 'ProposalCreated').args.proposalId;

    console.log('Proposal id ' + proposalId);
    await execProposal(governor, ovn, proposalId, wallet);

    console.log(`UsdPlus[${usdPlus.address}].hasRoleExchanger(): ${wallet.address}=> ${await usdPlus.hasRole(await usdPlus.EXCHANGER(), wallet.address)}`);


}


async function execProposal(governator, ovn, id, wallet) {

    let quorum = fromOvnGov(await governator.quorum(await ethers.provider.getBlockNumber() - 1));
    console.log('Quorum: ' + quorum);

    const proposalId = id;

    let votes = ethers.utils.parseUnits("100000100", 9);

    let state = proposalStates[await governator.state(proposalId)];
    if (state === "Executed") {
        return;
    }

    console.log('State status: ' + state)
    await ethers.provider.send('evm_mine'); // wait 1 block before opening voting

    console.log('Votes: ' + votes)
    await governator.castVote(proposalId, 1);

    let item = await governator.proposals(proposalId);
    console.log('Votes for: ' + item.forVotes / 10 ** 18);

    let total = fromOvnGov(await ovn.getVotes(wallet.address));
    console.log('Delegated ' + total)

    let waitBlock = 200;
    const sevenDays = 7 * 24 * 60 * 60;
    for (let i = 0; i < waitBlock; i++) {
        await ethers.provider.send("evm_increaseTime", [sevenDays])
        await ethers.provider.send('evm_mine'); // wait 1 block before opening voting
    }

    state = proposalStates[await governator.state(proposalId)];
    expect(state).to.eq('Succeeded');
    await governator.queueExec(proposalId);
    await ethers.provider.send('evm_mine'); // wait 1 block before opening voting
    await governator.executeExec(proposalId);


    state = proposalStates[await governator.state(proposalId)];
    console.log('State status: ' + state)
    expect(state).to.eq('Executed');
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

