const axios = require('axios');
const { Client, Wallet } = require('xrpl');
const basex = require('base-x');
const chalk = require('chalk');
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const bs58 = basex(BASE58);
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

// Base URL for IPFS gateway
let prefixPinata = "https://gateway.pinata.cloud/ipfs/";

//Verifies the cryptographic signature against the provided data using a public key.
function verifySignature(data, signature, publicKey) {
    try {
        const key = ec.keyFromPublic(publicKey, 'hex');
        return key.verify(data, signature);
    } catch (error) {
        console.error('Error verifying signature:', error);
        return false;
    }
}

// Retrieves DID objects from the XRP Ledger for a given address
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
        return base58Encoded;
    } catch (error) {
        console.error(chalk.red(`Error fetching DID objects for ${address}:`, error));
        return null;
    } finally {
        await client.disconnect();
    }
}

// Fetches JSON data from IPFS using the provided URL
async function fetchJsonFromIPFS(url) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching JSON from IPFS via Pinata:', error);
        throw error;
    }
}

// Fetches JSON from IPFS based on a given content identifier (CID)
async function fetchJsonFromIPFS_CID(cid) {
    const url = `${prefixPinata}${cid}`;
    return fetchJsonFromIPFS(url);
}

// Resolves a DID to retrieve the document or public key hex from IPFS
async function resolveDID(id) {
    const [did, idSuffix] = id.split("#");
    const address = did.substring(11);
    const cid = await getDIDObjects(address);
    const didDocument = await fetchJsonFromIPFS_CID(cid);

    if (!idSuffix) {
        return didDocument;
    } else {
        const target = didDocument[idSuffix.startsWith("key") ? "verificationMethod" : "service"];
        const result = target.find(method => method.id === id);
        if (!result) {
            throw new Error('Target not found in DID document');
        }
        return idSuffix.startsWith("key") ? result.publicKeyHex : await fetchJsonFromIPFS(result.serviceEndpoint);
    }
}

// Verifies a verifiable presentation (VP) including its embedded credentials
async function verifyVP(vp) {
    const { proof } = vp;
    const publicKey = await resolveDID(proof.verificationMethod);
    const signature = proof.signature;

    const documentCopy = { ...vp };
    delete documentCopy.proof;
    const data = JSON.stringify(documentCopy) + proof.challenge + proof.domain;

    const isValid = verifySignature(data, signature, publicKey);
    if (!isValid) {
        console.log(chalk.red("The signature of the VP is not valid."));
        return;
    }

    let allCredentialsValid = true;
    for (const vc of vp.verifiableCredential) {
        console.log(chalk.green("Start verification of VC"));
        const vcCopy = { ...vc };
        const vcProof = vcCopy.proof;
        const vcPublicKey = await resolveDID(vcProof.verificationMethod);

        delete vcCopy.proof;
        const vcDataToSign = JSON.stringify(vcCopy);
        if (!verifySignature(vcDataToSign, vcProof.signature, vcPublicKey)) {
            allCredentialsValid = false;
            console.log(chalk.red("A credential in the VP is not valid."));
            break;
        } else {
            console.log(chalk.blue("Credential verified successfully."));
        }
    }

    if (allCredentialsValid) {
        console.log(chalk.green("The VP was verified successfully."));
    } else {
        console.log(chalk.red("The VP contains invalid credentials."));
    }
}

// Example usage
async function main() {
    await verifyVP({
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
          "created": "2024-04-25T16:30:30.825Z",
          "proofPurpose": "authentication",
          "verificationMethod": "did:xrpl:1:rp5vPZ49XvsqVtuWvaCSgwSbcya1HVpnaZ#keys-1",
          "challenge": "4b7bb9630a3f83384eb940473a99e30b51f9890b4afada73f9c17b847381806f",
          "domain": "http://xyz:5001/api/v1/auth/vp-signin",
          "signature": "3044022073481b90737d31c5f7a58d4766485bc38174f2cd28c304def88de3d4d0045fab0220478ee218c2244f6d9513bded22544dda7e879a31b660d3b97768fadc211402cf"
        }
      });
}

main();
