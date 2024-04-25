# XRPL DID Integration for Verifiable Credentials and Presentations

This repository demonstrates the integration of **Decentralized Identifiers (DIDs)** using the **XRP Ledger (XRPL)** to manage and verify **Verifiable Credentials (VCs)** and **Verifiable Presentations (VPs)**. Our tools enable the creation of DIDs and DID documents, facilitating the issuance and verification of credentials based on cryptographic proofs.

## Features

- **DID Management on XRPL**: Create and resolve DIDs directly on the XRP Ledger.
- **DID Document Retrieval**: Fetch DID documents from XRPL for verification purposes.
- **Verifiable Credential Creation**: Generate credentials that assert claims about an identity, such as qualifications or affiliations.
- **Verifiable Presentation Compilation**: Compile one or more VCs into a presentation with additional cryptographic proofs for use in authentication and authorization.
- **Cryptographic Signatures**: Utilize elliptic curve cryptography (secp256k1) to sign and verify data.
- **IPFS Integration**: Use InterPlanetary File System (IPFS) for decentralized storage of VC and VP data.
