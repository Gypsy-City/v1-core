const dotenv = require("dotenv").config();
const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

// DefaultAzureCredential expects the following three environment variables:
// * AZURE_TENANT_ID: The tenant ID in Azure Active Directory
// * AZURE_CLIENT_ID: The application (client) ID registered in the AAD tenant
// * AZURE_CLIENT_SECRET: The client secret for the registered application

async function update_address(name, address) {
  try {
    console.log("Saving variable:", name, " with ", address);
    const credential = new DefaultAzureCredential();

    const VAULT_NAME = process.env.VAULT_NAME;
    const url = `https://${VAULT_NAME}.vault.azure.net`;
    const client = new SecretClient(url, credential);

    let result = await client.setSecret(name, address);

    console.log("Successfully updated ", name, " !");
  } catch (error) {
    console.error(error);
  }
}

module.exports = update_address;
