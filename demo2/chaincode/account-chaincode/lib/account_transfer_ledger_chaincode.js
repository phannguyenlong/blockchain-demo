/**
 * List of all funcion
 * createAccount(ctx, accountID, bank, balance, owner)
 * ReadAccount(ctx, id)
 * GetAllAccount(ctx)
 * AccountExists(ctx, id)
 * DeleteAccount(ctx, id)
 * TransferMoney(ctx, buyerID, ownerID, amount
 * GetAccountHistory(ctx, assetName)
 */

'use strict';

const {Contract, Info} = require('fabric-contract-api');

class Chaincode extends Contract {

	// CreateAsset - create a new asset, store into chaincode state
	async createAccount(ctx, accountID, bank, balance, owner) {
		const exists = await this.AccountExists(ctx, accountID);
		balance = parseFloat(balance)
		if (exists) {
			throw new Error(`The account ${accountID} already exists`);
		}

		// ==== Create asset object and marshal to JSON ====
		let account = {
			docType: 'account',
			accountID: accountID,
			bank: bank,
			balance: balance,
			owner: owner,
		};


		// === Save asset to state ===
		await ctx.stub.putState(accountID, Buffer.from(JSON.stringify(account)));
		let indexName = 'bank~name';
		let colorNameIndexKey = await ctx.stub.createCompositeKey(indexName, [account.bank, account.accountID]);

		//  Save index entry to state. Only the key name is needed, no need to store a duplicate copy of the marble.
		//  Note - passing a 'nil' value will effectively delete the key from state, therefore we pass null character as value
		await ctx.stub.putState(colorNameIndexKey, Buffer.from('\u0000'));
	}

	// ReadAsset returns the asset stored in the world state with given id.
	async ReadAccount(ctx, id) {
		let queryString = {}
        queryString.selector = {}
		queryString.selector.docType = "account"
		queryString.selector.accountID = id
		const accountJSON = await this.QuerryAccount(ctx, JSON.stringify(queryString)); // get the asset from chaincode state
		if (!accountJSON || accountJSON.length === 0) {
			throw new Error(`Account ${id} does not exist`);
		}

		return JSON.parse(accountJSON);
	}

	async GetAllAccount(ctx) {
		let queryString = {}
        queryString.selector = {}
		queryString.selector.docType = "account"
		const accountJSON = await this.QuerryAccount(ctx, JSON.stringify(queryString)); // get the asset from chaincode state
		return accountJSON.toString();
	}


	// AssetExists returns true when asset with given ID exists in world state
	async AccountExists(ctx, id) {
		// ==== Check if asset already exists ====
		let accounts = await this.ReadAccount(ctx, id);
		return accounts.length > 0 ;
	}

	// delete - remove a asset key/value pair from state
	async DeleteAccount(ctx, id) {
		if (!id) {
			throw new Error('Account id must not be empty');
		}

		let exists = await this.AccountExists(ctx, id);
		if (!exists) {
			throw new Error(`Account ${id} does not exist`);
		}

		// to maintain the color~name index, we need to read the asset first and get its color
		let valAsbytes = await ctx.stub.getState(id); // get the asset from chaincode state

		let accountJSON;
		try {
			accountJSON = JSON.parse(valAsbytes.toString());
		} catch (err) {
			throw new Error(`Failed to decode JSON of: ${valAsbytes.toString()}`);
		}
		await ctx.stub.deleteState(id); //remove the asset from chaincode state

		// delete the index
		let indexName = 'bank~name';
		let indexKey = ctx.stub.createCompositeKey(indexName, [accountJSON.bank, accountJSON.accountID]);
		if (!indexKey) {
			throw new Error(' Failed to create the createCompositeKey');
		}
		//  Delete index entry to state.
		await ctx.stub.deleteState(indexKey);
	}


	// User for update account(money from buyer to owner)
	async TransferMoney(ctx, buyerID, ownerID, amount) {
		if (buyerID == ownerID) throw new Error("Can not transfer to yourself")
		let buyer = await ctx.stub.getState(buyerID)
		let ownner = await ctx.stub.getState(ownerID)
		try {
			buyer = JSON.parse(buyer.toString());
			ownner = JSON.parse(ownner.toString());
		} catch (err) {
			throw new Error("Error: " + err)
		}

		amount = parseFloat(amount) // prevent conver to string
		if (buyer.balance < amount) {
			throw new Error(`Account ${buyerID} do not have enough balance`)
		}

		buyer.balance -= amount
		ownner.balance = ownner.balance + amount
		
		try {
			await ctx.stub.putState(buyerID, Buffer.from(JSON.stringify(buyer)))
			await ctx.stub.putState(ownerID, Buffer.from(JSON.stringify(ownner)))
		} catch (err) {
			throw new Error(err)
		}
	}
	
	// GetAssetHistory returns the chain of custody for an asset since issuance.
	async GetAccountHistory(ctx, assetName) {

		let resultsIterator = await ctx.stub.getHistoryForKey(assetName);
		let results = await this._GetAllResults(resultsIterator, true);

		return JSON.stringify(results);
	}

	// Example: Ad hoc rich query
	// QueryAssets uses a query string to perform a query for assets.
	// Query string matching state database syntax is passed in and executed as is.
	// Supports ad hoc queries that can be defined at runtime by the client.
	// If this is not desired, follow the QueryAssetsForOwner example for parameterized queries.
	// Only available on state databases that support rich query (e.g. CouchDB)
	async QuerryAccount(ctx, queryString) {
		return await this.GetQueryResultForQueryString(ctx, queryString);
	}

	// GetQueryResultForQueryString executes the passed in query string.
	// Result set is built and returned as a byte array containing the JSON results.
	async GetQueryResultForQueryString(ctx, queryString) {

		let resultsIterator = await ctx.stub.getQueryResult(queryString);
		let results = await this._GetAllResults(resultsIterator, false);

		return JSON.stringify(results);
	}

	// This is JavaScript so without Funcation Decorators, all functions are assumed
	// to be transaction functions
	//
	// For internal functions... prefix them with _
	async _GetAllResults(iterator, isHistory) {
		let allResults = [];
		let res = await iterator.next();
		while (!res.done) {
			if (res.value && res.value.value.toString()) {
				let jsonRes = {};
				console.log(res.value.value.toString('utf8'));
				if (isHistory && isHistory === true) {
					jsonRes.TxId = res.value.txId;
					jsonRes.Timestamp = res.value.timestamp;
					try {
						jsonRes.Value = JSON.parse(res.value.value.toString('utf8'));
					} catch (err) {
						console.log(err);
						jsonRes.Value = res.value.value.toString('utf8');
					}
				} else {
					jsonRes.Key = res.value.key;
					try {
						jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
					} catch (err) {
						console.log(err);
						jsonRes.Record = res.value.value.toString('utf8');
					}
				}
				allResults.push(jsonRes);
			}
			res = await iterator.next();
		}
		iterator.close();
		return allResults;
	}

	// InitLedger creates sample assets in the ledger
	async InitLedger(ctx) {
		const accounts = [
			{
				accountID: 'account1',
				bank: 'VCB',
				balance: 2000,
				owner: 'Phan nguyen long',
			},
			{
				accountID: 'account2',
				bank: 'Moiz Bank',
				balance: 2000,
				owner: 'The Moiz',
			},
			{
				accountID: 'account3',
				bank: 'Thao Bank',
				balance: 2000,
				owner: 'Moiz the conqueror',
			}
		]

		for (const account of accounts) {
			await this.createAccount(
				ctx,
				account.accountID,
				account.bank,
				account.balance,
				account.owner
			);
		}

	}
}

module.exports = Chaincode;
