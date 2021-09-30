// Use for web
'use strict';

const { Wallets } = require('fabric-network');
const path = require('path');
const { buildCCPOrg1, buildWallet } = require('../../../test-application/javascript/AppUtil.js');

const walletPath = path.join(__dirname, '../wallet');
const channelName = 'mychannel';
const org1UserId = 'admin';

exports.createContract = async function (gateway, chaincodeName, indentity) {
     //================ set up part =============
    // build connection profile, which is org1
    const ccp = buildCCPOrg1() // this is client
    // set up wallet
    const wallet = await buildWallet(Wallets, walletPath)

    try {
        await gateway.connect(ccp, {
            wallet,
            identity: indentity,
            discovery: {enabled: true, asLocalhost: true}
        })

        // creat hyperfleger network instance
        const network = await gateway.getNetwork(channelName)
        // get contract from the network
        return network.getContract(chaincodeName)

    } catch (err) {
        console.error("error: " + err)
    }
}