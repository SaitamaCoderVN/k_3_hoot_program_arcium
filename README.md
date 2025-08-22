# K3 Hoot Program with Arcium Integration

## 🎯 Overview
A secure quiz system using Arcium for encryption/decryption and answer validation without revealing sensitive information.

## 🔐 Quiz Encryption Flow

### 1. Create Quiz Set
- Create a quiz set with a specified number of questions
- Each quiz set has a unique ID to avoid conflicts

### 2. Encrypt Questions
- **X-coordinate**: Encrypt question + 4 choices
- **Y-coordinate**: Encrypt the correct answer
- Each question uses a unique nonce for security

### 3. Blockchain Storage
- Store point A (x, y) on the blockchain
- X-coordinate: encrypted question + choices
- Y-coordinate: encrypted correct answer

## 🔓 Quiz Decryption Flow

### 1. Retrieve Quiz Data
- Access quiz set from the blockchain
- Retrieve encrypted points A (x, y)

### 2. Decrypt X-coordinate
- Decrypt the x-coordinate to get the question + 4 choices
- Use the corresponding nonce for each question

### 3. Store in IPFS
- Store decrypted questions in IPFS
- Create metadata with security information
- Save the list of IPFS hashes

### 4. Select Answer
- Developer selects an answer from the decrypted choices
- The answer is compared with the encrypted y-coordinate

## 🔐 Answer Validation

### 1. Secure Comparison
- Use Arcium to compare the user's answer with the correct answer
- Never reveal the correct answer during validation

### 2. Result
- Return true/false without revealing any other information
- Complete security through zero-knowledge proof

## 🚀 Usage

### Create Quiz
