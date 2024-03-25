#!/bin/sh
export HOME=/home/ec2-user
sudo yum update -y 
sudo yum install mysql -y
sudo yum install jq -y

aws configure set region $REGION
secret=$(aws secretsmanager get-secret-value --secret-id $SECRET_ARN --query SecretString --output text)

# Phân tích JSON chứa thông tin secret
DB_HOST=$(echo "$secret" | jq -r '.host')
DB_NAME=$(echo "$secret" | jq -r '.dbname')
DB_USERNAME=$(echo "$secret" | jq -r '.username')
DB_PASSWORD=$(echo "$secret" | jq -r '.password')

echo "Init DB of demo data ..."
mysql -h $DB_HOST -u $DB_USERNAME -p$DB_PASSWORD <<EOF
 CREATE DATABASE IF NOT EXISTS $DB_NAME;
 USE $DB_NAME;
 CREATE TABLE IF NOT EXISTS transactions(id INT NOT NULL AUTO_INCREMENT, amount DECIMAL(102), description VARCHAR(100), PRIMARY KEY(id));
 INSERT INTO transactions (amount,description) VALUES ('400','groceries');   
 SELECT * FROM transactions;
EOF
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
source ~/.bashrc
nvm install 16
nvm use 16
version=$(node --version)
node -e "console.log('Running Node.js ' + process.version)"
npm install -g pm2
cd /home/ec2-user
aws s3 cp s3://$S3BucketName/app-tier/ app-tier --recursive
cd /home/ec2-user/app-tier
echo "Updating environment variables..."
sudo sed -i "s/DB_ENDPOINT/$DB_HOST/g" DbConfig.js
sudo sed -i "s/DB_USERNAME/$DB_USERNAME/g" DbConfig.js
sudo sed -i "s/DB_PASSWORD/$DB_PASSWORD/g" DbConfig.js
sudo sed -i "s/DB_NAME/$DB_NAME/g" DbConfig.js
echo "Starting the application using PM2..."
npm install 
pm2 start index.js 
echo "pm2 list ..."
pm2 startup
pm2 save