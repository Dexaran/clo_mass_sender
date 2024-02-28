const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { Web3 } = require('web3');
require('dotenv').config();

const RPC = 'https://rpc.callisto.network/';
const ADDRESS_COL = Number(process.env.ADDRESS_COL || '0');
const VALUE_COL = Number(process.env.VALUE_COL || '3');
const IN_FILE = process.env.IN_FILE || 'in_file.csv';
const OUT_FILE = process.env.OUT_FILE || 'out_file.csv';
const THRESHOLD = Number(process.env.THRESHOLD || '0'); // skip too small payouts
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BATCH_SIZE = 500; //

let gasPrice;

async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(-1), ms);
    });
}


async function getGasPrice(web3) {
    let res;

    try {
        res = await web3.eth.getGasPrice();
        res += 1000000000n;
    } catch (e) {
        console.error(e);
        res = web3.utils.toWei('1002','ether');
    }

    return res;
}

async function sendTx(web3, key, address, value, nonce) {
    const txConfig = {
        to: address,
        value:  web3.utils.toWei(value, 'ether'),
        gas: 21001n,
        gasPrice,
        nonce
    };

    console.dir(txConfig);

    try {
        const signed = await web3.eth.accounts.signTransaction(txConfig, key);
        await web3.eth.sendSignedTransaction(signed.rawTransaction);
        return signed.transactionHash;
    } catch (e) {
        console.error(e);
        throw e;
    }
}

function getAddressFromKey(web3, key) {
    let keyStr = key;
    if (key.indexOf('0x') !== 0) {
        keyStr = `0x${key}`;
    }
    const account = web3.eth.accounts.privateKeyToAccount(keyStr);
    return account.address;
}

function parseCSV(filePath) {
    const results = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    return new Promise((resolve, reject) => {
        // Event listener for each line in the CSV file
        rl.on('line', (line) => {
            // Split the line into an array of values
            const values = line.split(';');

            // Process each value as needed
            const val = Number(values[VALUE_COL]);
            if (!isNaN(val)) {
                if (val >= THRESHOLD) {
                    results.push([values[ADDRESS_COL], val]);
                }
            }
        });

        // Event listener when the file reading is complete
        rl.on('close', () => {
            // The CSV parsing is complete
            resolve(results);
        });

        // Event listener for errors during file reading
        fileStream.on('error', (error) => {
            // Handle errors during file reading
            reject(error);
        });
    });
}

// main ()
(async () => {
     // init Web3 provider
    const web3 = new Web3(RPC);
    const netId = await web3.eth.net.getId();
    console.log(`Connected to: ${netId}`);

    let workArray = [];
    try {
        workArray = await parseCSV(path.resolve(__dirname + `/${IN_FILE}`));
    } catch (e) {
        console.error('Error reading file');
        console.error(e);
        return;
    }

    console.log(`Got ${workArray.length} lines`);

    let sum = 0;
    for (let line of workArray) {
        sum += line[1];
    }

    if (!PRIVATE_KEY) {
        console.log('Please provide PRIVATE KEY of your wallet in PRIVATE_KEY env variable.');
        return;
    }

    const sourceAddress = getAddressFromKey(web3, PRIVATE_KEY);
    console.log(`Source wallet address; ${sourceAddress}`);

    // check wallet balance
    const feeRequired = workArray.length * 0.022;
    const weiBalance = await web3.eth.getBalance(sourceAddress);
    const walletBalance = Number(web3.utils.fromWei(weiBalance, 'ether'));

    console.log(`Source balance: ${walletBalance}`);
    if ((sum + feeRequired) > walletBalance) {
        console.log(`Not enough CLO on your Wallet.\nRequired: ${sum + feeRequired} CLO`);
        return;
    }

    gasPrice = await getGasPrice(web3);

    const outFile = path.resolve(__dirname + `/${OUT_FILE}`);
    fs.writeFileSync(outFile, '', 'utf8');
    let outWriter = fs.createWriteStream(outFile, {
        flags: 'a' // 'a' means appending (old data will be preserved)
    });
    outWriter.write(`address;value;tx_hash`);

    let finished = false;
    while (!finished) {
        let toRepeat = [];

        let promises = [];
        let processing = [];
        let count = 0;
        let nonce = await web3.eth.getTransactionCount(sourceAddress);
        for (let j = 0; j < workArray.length; j++) {
            count++;
            const line = workArray[j];
            processing.push(line);
            promises.push(sendTx(web3, PRIVATE_KEY, line[0], line[1], nonce));
            nonce++;

            if (count === BATCH_SIZE || j === workArray.length-1) {
                const results = await Promise.allSettled(promises);

                // parse results
                for (let i = 0; i < promises.length; i++) {
                    const res = results[i];
                    if (res.status === 'fulfilled') {
                        const procLine = processing[i];
                        outWriter.write(`\n${procLine[0]};${procLine[1]};${res.value}`);
                    } else {
                        toRepeat.push(processing[i]);
                    }
                }

                nonce = await web3.eth.getTransactionCount(sourceAddress);
                promises = [];
                processing = [];
                count = 0;
            }
        }

        if (toRepeat.length) {
            workArray = toRepeat;
            console.log(`Trying to repeat ${toRepeat.length} TXs`);
            await sleep(10000); // wait 10 secs before retry
        } else {
            finished = true;
        }
    }

    outWriter.end(); // close string
})();