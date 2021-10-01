/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin, regsiterUser, enrollUser } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../test-application/javascript/AppUtil.js');

const mspOrg1 = 'Org1MSP';

const walletPath = path.join(__dirname, 'wallet');
const userId = 'test';

function prettyJSONString(inputString) {
	return JSON.stringify(JSON.parse(inputString), null, 2);
}

async function main() {
	let skipInit = false;
	if (process.argv.length > 2) {
		if (process.argv[2] === 'skipInit') {
			skipInit = true;
		}
	}

	try {
		// build an in memory object with the network configuration (also known as a connection profile)
		const ccp = buildCCPOrg1();

		// build an instance of the fabric ca services client based on
		// the information in the network configuration
		const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');

		// setup the wallet to hold the credentials of the application user
		const wallet = await buildWallet(Wallets, walletPath);

		// in a real application this would be done on an administrative flow, and only once
		await enrollAdmin(caClient, wallet, mspOrg1);

		// in a real application this would be done only when a new user was required to be added
		// and would be part of an administrative flow
		await registerAndEnrollUser(caClient, wallet, mspOrg1, userId, 'org1.department1'); // use for running app

		await regsiterUser(caClient, wallet, mspOrg1, 'account1', 'password1', 'org1.department1')
		await regsiterUser(caClient, wallet, mspOrg1, 'account2', 'password2', 'org1.department1')
		await regsiterUser(caClient, wallet, mspOrg1, 'account3', 'password3', 'org1.department1')


		// secret = await enrollUser(caClient, wallet, mspOrg1, 'account1', 'password1', 'bbbbb');

	} catch (error) {
		console.error(`******** FAILED to run the application: ${error}`);
	}

	console.log('*** application ending');

}

main();
