'use strict';
/**
 * List of all fucntion 
 * CreateAsset(ctx, assetID, name, color, size, owner, appraisedValue)
 * ReadAsset(ctx, id)
 * GetAllAsset(ctx)
 * DeleteAsset(ctx, id)
 * AssetExists(ctx, assetName)
 * TransferAsset(ctx, assetName, newOwner)
 * QueryAssetsByOwner(ctx, owner)
 * GetAssetHistory(ctx, assetName)
 */

const {Contract} = require('fabric-contract-api');

class Chaincode extends Contract {

	// CreateAsset - create a new asset, store into chaincode state
	async CreateAsset(ctx, assetID, name, color, size, owner, appraisedValue) {
		const exists = await this.AssetExists(ctx, assetID);
		if (exists) {
			throw new Error(`The asset ${assetID} already exists`);
		}

		// ==== Create asset object and marshal to JSON ====
		let asset = {
			docType: 'asset',
			name: name,
			assetID: assetID,
			color: color,
			size: size,
			owner: owner,
			appraisedValue: appraisedValue
		};


		// === Save asset to state ===
		await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
		let indexName = 'color~name';
		let colorNameIndexKey = await ctx.stub.createCompositeKey(indexName, [asset.color, asset.assetID]);

		//  Save index entry to state. Only the key name is needed, no need to store a duplicate copy of the marble.
		//  Note - passing a 'nil' value will effectively delete the key from state, therefore we pass null character as value
		await ctx.stub.putState(colorNameIndexKey, Buffer.from('\u0000'));
	}

	// ReadAsset returns the asset stored in the world state with given id.
	async ReadAsset(ctx, id) {
		const assetJSON = await ctx.stub.getState(id); // get the asset from chaincode state
		if (!assetJSON || assetJSON.length === 0) {
			throw new Error(`Asset ${id} does not exist`);
		}

		return assetJSON.toString();
	}

	async GetAllAsset(ctx) {
		let queryString = {}
        queryString.selector = {}
		queryString.selector.docType = "asset"
		const accountJSON = await this.QueryAssets(ctx, JSON.stringify(queryString)); // get the asset from chaincode state
		return accountJSON.toString();
	}

	// delete - remove a asset key/value pair from state
	async DeleteAsset(ctx, id) {
		if (!id) {
			throw new Error('Asset name must not be empty');
		}

		let exists = await this.AssetExists(ctx, id);
		if (!exists) {
			throw new Error(`Asset ${id} does not exist`);
		}

		// to maintain the color~name index, we need to read the asset first and get its color
		let valAsbytes = await ctx.stub.getState(id); // get the asset from chaincode state
		let jsonResp = {};
		if (!valAsbytes) {
			jsonResp.error = `Asset does not exist: ${id}`;
			throw new Error(jsonResp);
		}
		let assetJSON;
		try {
			assetJSON = JSON.parse(valAsbytes.toString());
		} catch (err) {
			jsonResp = {};
			jsonResp.error = `Failed to decode JSON of: ${id}`;
			throw new Error(jsonResp);
		}
		await ctx.stub.deleteState(id); //remove the asset from chaincode state

		// delete the index
		let indexName = 'color~name';
		let colorNameIndexKey = ctx.stub.createCompositeKey(indexName, [assetJSON.color, assetJSON.assetID]);
		if (!colorNameIndexKey) {
			throw new Error(' Failed to create the createCompositeKey');
		}
		//  Delete index entry to state.
		await ctx.stub.deleteState(colorNameIndexKey);
	}

	// AssetExists returns true when asset with given ID exists in world state
	async AssetExists(ctx, assetName) {
		// ==== Check if asset already exists ====
		let assetState = await ctx.stub.getState(assetName);
		return assetState && assetState.length > 0;
	}

	// TransferAsset transfers a asset by setting a new owner name on the asset
	async TransferAsset(ctx, assetName, newOwner) {

		let assetAsBytes = await ctx.stub.getState(assetName);
		if (!assetAsBytes || !assetAsBytes.toString()) {
			throw new Error(`Asset ${assetName} does not exist`);
		}
		let assetToTransfer = {};
		try {
			assetToTransfer = JSON.parse(assetAsBytes.toString()); //unmarshal
		} catch (err) {
			let jsonResp = {};
			jsonResp.error = 'Failed to decode JSON of: ' + assetName;
			throw new Error(jsonResp);
		}
		assetToTransfer.owner = newOwner; //change the owner

		let assetJSONasBytes = Buffer.from(JSON.stringify(assetToTransfer));
		await ctx.stub.putState(assetName, assetJSONasBytes); //rewrite the asset
	}


	// QueryAssetsByOwner queries for assets based on a passed in owner.
	async QueryAssetsByOwner(ctx, owner) {
		let queryString = {};
		queryString.selector = {};
		queryString.selector.docType = 'asset';
		queryString.selector.owner = owner;
		return await this.GetQueryResultForQueryString(ctx, JSON.stringify(queryString)); //shim.success(queryResults);
	}

	// GetAssetHistory returns the chain of custody for an asset since issuance.
	async GetAssetHistory(ctx, assetName) {

		let resultsIterator = await ctx.stub.getHistoryForKey(assetName);
		let results = await this._GetAllResults(resultsIterator, true);

		return JSON.stringify(results);
	}

	// Example: Ad hoc rich query
	async QueryAssets(ctx, queryString) {
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
		const assets = [
			{
				assetID: 'asset1',
				name: "Flower of trust",
				color: 'blue',
				size: 5,
				owner: 'account1',
				appraisedValue: 100
			},
			{
				assetID: 'asset2',
				name: "To the Moiz and beyond",
				color: 'red',
				size: 5,
				owner: 'account2',
				appraisedValue: 100
			},
			{
				assetID: 'asset3',
				name: "Statue of Moiz",
				color: 'green',
				size: 10,
				owner: 'account3',
				appraisedValue: 200
			},
			{
				assetID: 'asset4',
				name: "Bigger Shrimp",
				color: 'yellow',
				size: 10,
				owner: 'account1',
				appraisedValue: 200
			},
			{
				assetID: 'asset5',
				name: "Moiz and Mory",
				color: 'black',
				size: 15,
				owner: 'account2',
				appraisedValue: 250
			},
			{
				assetID: 'asset6',
				name: "Happy hour",
				color: 'white',
				size: 15,
				owner: 'account3',
				appraisedValue: 250
			},
		];

		for (const asset of assets) {
			await this.CreateAsset(
				ctx,
				asset.assetID,
				asset.name,
				asset.color,
				asset.size,
				asset.owner,
				asset.appraisedValue
			);
		}
	}
}

module.exports = Chaincode;
