var express = require('express');  
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
const crypto = require('crypto');
var app = express();

// config app
app.use(cookieParser())
app.use(bodyParser.urlencoded({ extended: true }));
 
// Config for getting indentity
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, enrollAdmin, regsiterUser, enrollUser } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../test-application/javascript/AppUtil.js');
const {createContract} = require('./util/WebUtil.js');

const channelName = 'mychannel';
const chaincodeName = 'asset';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'admin';
const SECRET_KEY = 'mysupersecretkeyhahahahaha'


//===============Index page===========
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, '/pages/index.html'));
});
//=============Asset Page===========
app.get('/assets', function(req, res) {
    res.sendFile(path.join(__dirname, '/pages/asset.html'));
});

//===========Account page==============
app.get('/account', function(req, res) {
    res.sendFile(path.join(__dirname, '/pages/account.html'));
});

//==============Login Page==============
app.get('/login', function(req, res) {
    res.sendFile(path.join(__dirname, '/pages/login.html'));
});
app.post("/login", async function (req, res) {
    let hash;
    try {
		const ccp = buildCCPOrg1();
		const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');
		const wallet = await buildWallet(Wallets, walletPath);
        
        // creat hash
        hash = crypto.createHmac('sha256', SECRET_KEY).update(req.body.username).digest('hex');

        await enrollUser(caClient, wallet, mspOrg1, req.body.username, req.body.password, hash);
	} catch (error) {
        console.error(`******** FAILED to run the application: ${error}`);
        res.redirect('/login')
    }
    // update session
    const gateway = new Gateway()

    try {
        // get contract from the network
        const contract = await createContract(gateway, 'account', hash)
        await contract.submitTransaction('UpdateAccountSession', req.body.username, hash)        
    } catch (err) {
        console.error("error: " + err)
        res.redirect('/login')
    } finally {
        gateway.disconnect()
    }

    // create cookie
    res.cookie('session', hash, { expires: new Date(Date.now() + 9000000000000000)})
    res.redirect("/") // success
})

//=============Register page==================
app.get('/register', function(req, res) {
    res.sendFile(path.join(__dirname, '/pages/register.html'));
});

app.post("/register", async function (req, res) {
    try {
		const ccp = buildCCPOrg1();
		const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');
        const wallet = await buildWallet(Wallets, walletPath);
        
        secret = await regsiterUser(caClient, wallet, mspOrg1, req.body.username, req.body.password, 'org1.department1');
        console.log(secret)
        if (secret) {
            res.redirect('/login')
        } else {
            res.redirect('/register')
        }

	} catch (error) {
        console.error(`******** FAILED to run the application: ${error}`);
        alert("Account exsist")
        res.redirect('/regiser')
	}
})

//===============Logout===============
app.get('/logout', async function (req, res) {
    const wallet = await buildWallet(Wallets, walletPath);

    wallet.remove(req.cookies.session)
    res.clearCookie("session");
    res.redirect('/login')
})

//================API=================
app.get('/api/queryAll', async function (req, res) {
    const gateway = new Gateway()

    try {
        // get contract from the network
        const contract = await createContract(gateway, 'asset', req.cookies.session)
        // test
        console.log("GET ALL ASSESTS")
        let data = await contract.evaluateTransaction('GetAllAsset')
        res.status(200).json(JSON.parse(data.toString()))
        
    } catch (err) {
        console.error("error: " + err)
        res.redirect('/login')
    } finally {
        gateway.disconnect()
    }
});

app.get('/api/asset/:id', async function (req, res) {
    //================ set up part =============
    const gateway = new Gateway()

    try {
        const contract = await createContract(gateway, 'asset', req.cookies.session)
        
        // test
        console.log("GET ASSESTS by ID")
        let data = await contract.evaluateTransaction('ReadAsset', req.params.id)
        res.status(200).json(JSON.parse(data.toString()))
        
    } catch (err) {
        console.error("error: " + err)
        res.redirect('/login')
    } finally {
        gateway.disconnect()

    }
});

app.post('/api/addAsset', async function (req, res) {
    const gateway = new Gateway()

    try {
        const contract = await createContract(gateway, 'asset', req.cookies.session)
        
        // test
        console.log("Create assets")
        let data = await contract.submitTransaction('CreateAsset', req.body.id, req.body.color, req.body.size, req.body.owner, req.body.appraisedValue)
        res.status(200).json(JSON.parse(data.toString()))
        
    } catch (err) {
        console.error("error: " + err)
        res.redirect('/login')
    } finally {
        gateway.disconnect()
    }
});


app.get('/api/deleteAsset/:id', async function (req, res) {
    const gateway = new Gateway()

    try {
        const contract = await createContract(gateway, 'asset', req.cookies.session)
        
        // test
        console.log("Delete assets")
        let data = await contract.submitTransaction('DeleteAsset', req.params.id)
        res.status(200).json(JSON.parse(data.toString()))
        
    } catch (err) {
        console.error("error: " + err)
        res.redirect('/login')
    } finally {
        gateway.disconnect()
    }
});

app.post('/api/transferAssets/', async function (req, res) {
    //================ set up part =============
    const gateway = new Gateway()
    console.log(req.body)

    // transfer money
    try {
        const contract = await createContract(gateway, 'account', req.cookies.session)
        
        // test
        console.log("Transfer money")
        let data = await contract.submitTransaction('TransferMoney', req.body.newOwner, req.body.owner, req.body.price)
        res.status(200).json(JSON.parse(data.toString()))
        
    } catch (err) {
        console.error("error: " + err)
        res.redirect('/login')
    } finally {
        gateway.disconnect()
    }

    // transfer asset
    try {
        const contract = await createContract(gateway, 'asset', req.cookies.session)
        
        // test
        console.log("Transfer assets")
        let data = await contract.submitTransaction('TransferAsset', req.body.assetID, req.body.newOwner)
        res.status(200).json(JSON.parse(data.toString()))
        
    } catch (err) {
        console.error("error: " + err)
        res.redirect('/login')
    } finally {
        gateway.disconnect()
    }
});

app.get("/api/asset/history/:id", async function (req, res) {
    const gateway = new Gateway()

    try {
        const contract = await createContract(gateway, 'asset', req.cookies.session)
        
        // test
        console.log("History of assets")
        let data = await contract.evaluateTransaction('GetAssetHistory', req.params.id)
        res.status(200).json(JSON.parse(data.toString()))
        
    } catch (err) {
        console.error("error: " + err)
        res.redirect('/login')
    } finally {
        gateway.disconnect()
    }
})

app.get("/api/account", async function (req, res) {
        //================ set up part =============
    const gateway = new Gateway()

    try {
        const contract = await createContract(gateway, 'account', req.cookies.session)
        
        // test
        console.log("Transfer assets")
        let data = await contract.evaluateTransaction('ReadAccountBySession', req.cookies.session)
        res.status(200).json(JSON.parse(data.toString()))
        
    } catch (err) {
        console.error("error: " + err)
        res.redirect('/login')
    } finally {
        gateway.disconnect()
    }
})

app.get("/api/account/history/:id", async function (req, res) {
    const gateway = new Gateway()

    try {
        const contract = await createContract(gateway, 'account', req.cookies.session)
        
        // test
        console.log("History of assets")
        let data = await contract.evaluateTransaction('GetAccountHistory', req.params.id)
        res.status(200).json(JSON.parse(data.toString()))
        
    } catch (err) {
        console.error("error: " + err)
        res.redirect('/login')
    } finally {
        gateway.disconnect()
    }
})

console.log("Server is listnening at port: 8080")
app.listen(8080)