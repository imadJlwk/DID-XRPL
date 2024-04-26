
const axios = require('axios');
const { Client, Wallet } = require('xrpl');
const basex = require('base-x');
const chalk = require('chalk');
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const bs58 = basex(BASE58);
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');


let prefixPinata = "https://gateway.pinata.cloud/ipfs/";

/**
 * Verifies a signature against the given data using the provided public key.
 * 
 * @param {String} data - The original data that was signed.
 * @param {String} signature - The signature to verify, in DER hex format.
 * @param {String} publicKey - The public key in hex format.
 * @returns {Boolean} - Returns true if the signature is valid, false otherwise.
 */
function verifySignature(data, signature, publicKey) {
    try {
        const key = ec.keyFromPublic(publicKey, 'hex');
        return key.verify(data, signature);
    } catch (error) {
        console.error('Error verifying signature:', error);
        return false;
    }
}

// Function to fetch DID objects from the XRP Ledger
async function getDIDObjects(address) {
    const client = new Client("wss://s.devnet.rippletest.net:51233/");
    try {
        await client.connect();
        const response = await client.request({
            command: "account_objects",
            account: address,
            ledger_index: "validated"
        });

        if (response.result.account_objects.length === 0) {
            console.log(chalk.yellow("No DID objects found."));
            return null;
        }

        const didDocumentHex = response.result.account_objects[0].DIDDocument;
        const prefixedHexString = "1220" + didDocumentHex;
        const buffer = Buffer.from(prefixedHexString, 'hex');
        const base58Encoded = bs58.encode(buffer);

        // console.log(chalk.blackBright(`DID Document Value: ${didDocumentHex}`));
        // console.log(chalk.green(`DID Document Base58 encoded: ${base58Encoded}`));
        // console.log(chalk.blue(`DID Document IPFS LINK : ${prefixPinata + base58Encoded}`));

        return base58Encoded;
    } catch (error) {
        console.error(chalk.red(`Error fetching DID objects for ${address}: ${error.message}`));
        return null;
    } finally {
        await client.disconnect();
    }
}
async function fetchJsonFromIPFS(url) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching JSON from IPFS via Pinata:', error);
        throw error;
    }
}
async function fetchJsonFromIPFS_CID(cid) {
    const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
    return fetchJsonFromIPFS ( url)
}

async function resolvDID(id) {

    const parts = id.split("#");
    const did = parts[0];
    const idSuffix = parts[1];
    
    let add = did.substring(11, 45)
    let cid = await getDIDObjects(add);
    let didDocument = await fetchJsonFromIPFS_CID(cid);
    if (!idSuffix) 
        return didDocument;
    else {
        if (idSuffix.startsWith("key")){
            const verificationMethod = didDocument.verificationMethod.find(method => method.id === id);
            if (!verificationMethod) {
                throw new Error('Verification method not found in DID document');
            }
            return verificationMethod.publicKeyHex
        }else if (idSuffix.startsWith("profile")){
            const service = didDocument.service.find(method => method.id === id);
            if (!service) {
                throw new Error('Verification method not found in DID document');
            }
            let profile = await fetchJsonFromIPFS(service.serviceEndpoint)
            return profile;
        }

    }
   
}

async function verifyVP(vp) {
    // Assume the document structure you provided, and these values are populated correctly
    const { proof } = vp;
    const publicKey = await resolvDID(proof.verificationMethod);
    const signature = proof.signature;

    // Recreate the data that was signed
    const documentCopy = { ...vp };
    delete documentCopy.proof;  // Remove the proof to recreate the original signed document
    const data = JSON.stringify(documentCopy);

    const isValid = verifySignature(data + proof.challenge + proof.domain, signature, publicKey);
    if (isValid) {
        let allCredentialsValid = true;
        const { verifiableCredential } = vp;
        let i = 1;
        for (const vc of verifiableCredential) {
            console.log(chalk.green("Start verification of VC "+1));

            const vcCopy = { ...vc };
            const proof = vcCopy.proof;
            const publicKey = await resolvDID(proof.verificationMethod);

            delete vcCopy.proof;  
            const dataToSign = JSON.stringify(vcCopy) 
            const isValid = verifySignature(dataToSign, proof.signature, publicKey);
            if (!isValid) {
                allCredentialsValid = false;
                console.log(chalk.read("A credential in the VP is not valid."));
                break;  
            } else {
                console.log(chalk.blue("  --> Credential Verified successfully."));
                let profile = await resolvDID(vcCopy.issuer+ "#profile");
                console.log(chalk.blue("  --> Issuer profile : " ,     JSON.stringify(profile, null, 2)));

            }
            i++;
        }
        if (allCredentialsValid) {
            console.log(chalk.green("The VP Verified successfully"));
        } else {
            console.log("The VP is not valid.");
        }
    } else {
        console.log("The signature of VP is not valid.");
        return
    }
}

// Example usage
async function main() {

    let VP = {
        "context": "https://www.w3.org/2018/credentials/v1",
        "type": "VerifiablePresentation",
        "verifiableCredential": [
          {
            "context": "https://www.w3.org/2018/credentials/v1",
            "type": [
              "VerifiableCredential"
            ],
            "issuer": "did:xrpl:1:rffGVvdyzRxT1KJLs6K4ZaNj5LiDJGxNvu",
            "issuanceDate": "2024-04-25T13:30:08.916Z",
            "credentialSubject": {
              "id": "did:xrpl:1:rp5vPZ49XvsqVtuWvaCSgwSbcya1HVpnaZ",
              "degree": {
                "type": "MasterDegree",
                "name": "Computer Science"
              }
            },
            "proof": {
              "type": "EcdsaSecp256k1RecoveryMethod2020",
              "created": "2024-04-25T13:30:08.925Z",
              "proofPurpose": "assertionMethod",
              "verificationMethod": "did:xrpl:1:rffGVvdyzRxT1KJLs6K4ZaNj5LiDJGxNvu#keys-1",
              "signature": "304502205ff2a72c8d51b23be64e6c5a59b15c4b9868b6b165f591bb5ae2e2fd7aec609d022100f05d21d38ffce93a974043f1654bb621f3418cbea48bf7130c8cfa069d92ac10"
            }
          }
        ],
        "proof": {
          "type": "EcdsaSecp256k1RecoveryMethod2020",
          "created": "2024-04-26T08:08:21.296Z",
          "proofPurpose": "authentication",
          "verificationMethod": "did:xrpl:1:rp5vPZ49XvsqVtuWvaCSgwSbcya1HVpnaZ#keys-1",
          "challenge": "4b7bb9630a3f83384eb940473a99e30b51f9890b4afada73f9c17b847381806f",
          "domain": "http://xyz:5001/api/v1/auth/vp-signin",
          "signature": "3044022073481b90737d31c5f7a58d4766485bc38174f2cd28c304def88de3d4d0045fab0220478ee218c2244f6d9513bded22544dda7e879a31b660d3b97768fadc211402cf"
        }
      }

    verifyVP(VP);
}

main();
