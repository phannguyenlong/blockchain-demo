const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet, prettyJSONString } = require('../../test-application/javascript/AppUtil.js');

const channelName = 'mychannel';
const chaincodeName = 'asset';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'test';


async function main() {
    //================ set up part =============
    // build connection profile, which is org1
    const ccp = buildCCPOrg1() // this is client
    // set up wallet
    const wallet = await buildWallet(Wallets, walletPath)

    // connect with hyperfleger network
    const gateway = new Gateway()

    try {
        await gateway.connect(ccp, {
            wallet,
            identity: org1UserId,
            discovery: {enabled: true, asLocalhost: true}
        })

        // creat hyperfleger network instance
        const network = await gateway.getNetwork(channelName)
        // get contract from the network
        const contract = network.getContract(chaincodeName)
        
        // test
        console.log('\n--> Evaluate Transaction: InitLedger');
        await contract.submitTransaction('InitLedger');

        // console.log('\n--> Evaluate Transaction: InitLedger');
        // let result = await contract.evaluateTransaction('GetAssetHistory', 'asset1');

        // console.log('\n--> Evaluate Transaction: InitLedger');
        // let result = await contract.submitTransaction('QueryAssetsByOwner', 'account2');

        // console.log('\n--> Evaluate Transaction: InitLedger');
        // let result = await contract.submitTransaction('TransferMoney', 'account1', 'account4', 200);

        // queryString = {}
        // queryString.selector = {}
        // queryString.selector.docType = "asset"
        // result = await contract.evaluateTransaction("QueryAssets", JSON.stringify(queryString))
        console.log(JSON.parse(result.toString()))
    } catch (err) {
        console.error("error: " + err)
    } finally {
        gateway.disconnect()
    }
}

main()