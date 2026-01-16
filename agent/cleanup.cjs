const { Composio } = require('@composio/core');
const client = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

async function cleanup() {
  const accounts = await client.connectedAccounts.list({});

  for (const acc of accounts.items || []) {
    if (acc.status !== 'ACTIVE') {
      console.log('Deleting ' + acc.toolkit?.slug + ' (' + acc.status + ')');
      await client.connectedAccounts.delete(acc.id);
    } else {
      console.log('Keeping ' + acc.toolkit?.slug + ' (ACTIVE)');
    }
  }

  console.log('\nFresh Twitter URL:');
  const conn = await client.connectedAccounts.initiate('brand-slug', 'ac_your_session_id');
  console.log(conn.redirectUrl);
}

cleanup();
