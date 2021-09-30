./network.sh up createChannel -s couchdb -ca

# Account chaincode
./network.sh deployCC -ccn account -ccp ../demo2/chaincode/account-chaincode -ccl javascript
# for update (increase version and sequence after each upgrade)
# ./network.sh deployCC -ccn account -ccp ../demo2/chaincode/account-chaincode -ccl javascript -ccs 2 -ccv 2.0

./network.sh deployCC -ccn asset -ccp ../demo2/chaincode/asset-chaincode -ccl javascript
# ./network.sh deployCC -ccn asset -ccp ../demo2/chaincode/asset-chaincode -ccl javascript -ccs 2 -ccv 2.0

rm -r ../demo2/application/wallet