const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

// Load environment variables
const bucketName = process.env.AWS_S3_BUCKET;
const region     = process.env.AWS_S3_REGION || 'us-east-1';
const accessKey  = process.env.AWS_ACCESS_KEY_ID;
const secretKey  = process.env.AWS_SECRET_ACCESS_KEY;

let s3Client = null;
const isConfigured = !!(bucketName && accessKey && secretKey);

if (isConfigured) {
    try {
        s3Client = new S3Client({
            region,
            credentials: {
                accessKeyId: accessKey,
                secretAccessKey: secretKey,
            }
        });
        console.log(`[CloudStorage] AWS S3 Client initialized in region: ${region}`);
    } catch (err) {
        console.error('[CloudStorage] Failed to initialize S3 client:', err.message);
    }
} else {
    console.log('[CloudStorage] AWS S3 credentials not fully configured. Offsite replication will run in local-only fallback mode.');
}

/**
 * Uploads a file to the configured offsite storage (S3)
 * @param {string} localFilePath - Path to the local file
 * @param {string} destinationFolder - Folder inside the S3 bucket (e.g., 'daily', 'weekly')
 * @param {string} destinationFileName - Name of the file inside S3 bucket
 * @returns {Promise<boolean>} Resolves to true if upload succeeded or skipped due to config fallback, false on actual upload error.
 */
async function uploadFileToCloud(localFilePath, destinationFolder, destinationFileName) {
    if (!isConfigured || !s3Client) {
        console.log(`[CloudStorage] S3 not configured. Local backup saved at: ${localFilePath}`);
        return true; // Graceful fallback
    }

    try {
        const fileStream = fs.createReadStream(localFilePath);
        const s3Key = `backups/${destinationFolder}/${destinationFileName}`;

        console.log(`[CloudStorage] Uploading ${destinationFileName} to S3 bucket ${bucketName} under path: ${s3Key}...`);

        const uploadCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: fileStream,
        });

        await s3Client.send(uploadCommand);
        console.log(`[CloudStorage] Successfully replicated file to S3: ${s3Key}`);
        return true;
    } catch (err) {
        console.error(`[CloudStorage] S3 upload failed for ${destinationFileName}:`, err.message);
        return false;
    }
}

/**
 * Downloads a file from the configured S3 bucket
 * @param {string} s3Key - Full key of the object in S3 (e.g. 'backups/daily/backup_daily_2026-05-26.zip')
 * @param {string} localDownloadPath - Path where the file should be saved locally
 * @returns {Promise<boolean>} Resolves to true if download succeeded
 */
async function downloadFileFromCloud(s3Key, localDownloadPath) {
    if (!isConfigured || !s3Client) {
        throw new Error('AWS S3 credentials not configured. Cannot download from cloud.');
    }

    try {
        console.log(`[CloudStorage] Downloading S3 object "${s3Key}" to "${localDownloadPath}"...`);

        const getCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
        });

        const response = await s3Client.send(getCommand);
        const writeStream = fs.createWriteStream(localDownloadPath);

        await new Promise((resolve, reject) => {
            response.Body.pipe(writeStream)
                .on('error', reject)
                .on('finish', resolve);
        });

        console.log(`[CloudStorage] Successfully downloaded offsite file to: ${localDownloadPath}`);
        return true;
    } catch (err) {
        console.error(`[CloudStorage] S3 download failed for key "${s3Key}":`, err.message);
        throw err;
    }
}

module.exports = {
    uploadFileToCloud,
    downloadFileFromCloud,
    isCloudConfigured: () => isConfigured,
};
