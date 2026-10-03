import {
  bsDataEntry,
  subcenterMaster,
  employeeMaster,
  villagesMaster,
  villageDetails,
  dengueChikungunyaEntries,
  monthMaster
} from '../data/store.js';

import { transferAllDataToFirestore } from '../services/firebaseStore.js';

async function main() {
  console.log('Starting full data transfer to Cloud Firestore...');
  console.log(`- BS Data Entries: ${bsDataEntry.length}`);
  console.log(`- Subcenters: ${subcenterMaster.length}`);
  console.log(`- Employees: ${employeeMaster.length}`);
  console.log(`- Villages Master: ${villagesMaster.length}`);
  console.log(`- Village Details: ${villageDetails.length}`);
  console.log(`- Dengue Entries: ${dengueChikungunyaEntries.length}`);

  const res = await transferAllDataToFirestore({
    bsDataEntry,
    subcenterMaster,
    employeeMaster,
    villagesMaster,
    villageDetails,
    dengueChikungunyaEntries,
    monthMaster
  });

  if (res.success) {
    console.log('✅ Firestore Transfer Completed Successfully!');
    console.log(JSON.stringify(res.results, null, 2));
  } else {
    console.error('❌ Firestore Transfer Failed:', res.error);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Error in transfer script:', err);
  process.exit(1);
});
