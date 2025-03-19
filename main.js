const chalk = require('chalk');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const axios = require('axios');
const fs = require('fs');
const nacl = require('tweetnacl');
const readline = require('readline');

// untuk animasi
async function showLoadingAnimation(message, color = 'yellow', duration = 3000) {
    const frames = ['.', '..', '...'];
    let i = 0;
    process.stdout.write(chalk[color](message));
    
    return new Promise(resolve => {
        const interval = setInterval(() => {
            process.stdout.write(`\r${chalk[color](message)} ${frames[i]}`);
            i = (i + 1) % frames.length;
        }, 500);

        setTimeout(() => {
            clearInterval(interval);
            process.stdout.write(`\r${chalk.green(message)}... Done!\n`);
            resolve();
        }, duration);
    });
}

// untuk membaca input
async function getUserInput(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => rl.question(chalk.cyan(question), answer => {
        rl.close();
        resolve(answer);
    }));
}

// untuk membuat wallet
async function createWallet() {
    await showLoadingAnimation("Waiting to Create Wallet", 'yellow');

    const keypair = Keypair.generate(); 
    const walletAddress = keypair.publicKey.toBase58();
    const privateKey = bs58.encode(keypair.secretKey);

    console.log(chalk.green("Successfully Created Wallet!"));
    return { walletAddress, privateKey };
}

// untuk login ke Flow3
async function loginToFlow3(wallet, referralCode) {
    await showLoadingAnimation("Attempting to Connect to Flow3", 'yellow');

    const message = "Please sign this message to connect your wallet to Flow 3 and verifying your ownership only.";
    
    // Sign pesan dengan private key
    const signatureUint8Array = nacl.sign.detached(
        Buffer.from(message), 
        bs58.decode(wallet.privateKey) // Decode private key
    );
    const signature = bs58.encode(signatureUint8Array);

    // Payload untuk API
    const payload = {
        message,
        referralCode,
        signature,
        walletAddress: wallet.walletAddress
    };

    try {
        const response = await axios.post("https://api.flow3.tech/api/v1/user/login", payload, {
            headers: { "Content-Type": "application/json" }
        });

        console.log(chalk.green("Successfully Connected Wallet to Flow3!"));

        // Simpan wallet ke file setelah sukses login
        fs.writeFileSync("wallet.txt", `${wallet.walletAddress} | ${wallet.privateKey}\n`, { flag: 'a' });

        // Simpan access token dan refresh token ke token.txt
        const accessToken = response.data.data.accessToken;
        const refreshToken = response.data.data.refreshToken;
        fs.writeFileSync("token.txt", `${accessToken} | ${refreshToken}\n`, { flag: 'a' });

        console.log(chalk.green("Access Token & Refresh Token saved to token.txt!"));
        return true; 
    } catch (error) {
        console.error(chalk.red("Error Connecting to Flow3:"), error.response ? error.response.data : error.message);
        return false; 
    }
}

// Function utama
(async () => {
    const referralCode = await getUserInput("Enter Referral Code: ");
    const howMany = parseInt(await getUserInput("How Many Referral Accounts?: "), 10);

    for (let i = 0; i < howMany; i++) {
        console.log(chalk.blue(`\nCreating Wallet ${i + 1}...`));

        try {
            const wallet = await createWallet();
            const success = await loginToFlow3(wallet, referralCode);

            // Jika gagal, lanjutkan ke akun berikutnya setelah delay
            if (!success) {
                console.log(chalk.red("Failed! Moving to next account after 10 seconds..."));
            }
        } catch (error) {
            console.error(chalk.red("Unexpected Error! Moving to next account after 10 seconds..."));
        }

        // Delay 10 detik sebelum lanjut ke akun berikutnya
        console.log(chalk.yellow("\nWaiting 10 seconds before creating next account...\n"));
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

    console.log(chalk.green("\n✅ All accounts have been created successfully!\n"));
})();
