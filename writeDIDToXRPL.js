const { Client, Wallet } = require('xrpl');
const chalk = require('chalk');

// Generates a wallet using a given secret
async function generateWalletFromSecret(secret) {
    const wallet = Wallet.fromSecret(secret);
    return wallet;
}

// Sets a DID document on the XRP Ledger
async function setDID(wallet, didIpfsHash) {
    const client = new Client("wss://s.devnet.rippletest.net:51233/");
    await client.connect();

    try {
        const prepared = await client.autofill({
            "TransactionType": "DIDSet",
            "Account": wallet.address,
            "DIDDocument": didIpfsHash
        });

        let signedTransaction = wallet.sign(prepared);

        const result = await client.submitAndWait(signedTransaction.tx_blob);
        console.log(chalk.blue(`Transaction result: ${JSON.stringify(result, null, 2)}`));
        return result;
    } catch (error) {
        console.error(chalk.red(`Error setting DID: ${error}`));
        return null;
    } finally {
        await client.disconnect();
    }
}

// Main function for wallet creation and DID setting on the XRP Ledger
async function main() {
    const issuerSecret = "sEdVRT1xCf2tFTzgbG9KR1G57us8SKH";
    let issuerWallet = await generateWalletFromSecret(issuerSecret);
    let issuerDIDIpfsHash = "408db59992f378af39e7c4ddc7a96ace826f9475e564ff3e4bfd9d72ee0e667e";
    await setDID(issuerWallet, issuerDIDIpfsHash);

    const userSecret = "sEdToXXs9NXwguHsJjbWi4bGVwtKqsP";
    let userWallet = await generateWalletFromSecret(userSecret);
    let userDIDIpfsHash = "dffafde488960b37a54f648889e2aa4d493a609f4a078cc96780a53da3811793";
    await setDID(userWallet, userDIDIpfsHash);
}

// Run the main function and handle any exceptions
main().catch(error => console.error(chalk.redBright(`Critical error encountered: ${error}`)));
