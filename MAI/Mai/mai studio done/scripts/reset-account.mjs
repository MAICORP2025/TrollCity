import fetch from 'node-fetch';

const resetAccount = async () => {
  try {
    const response = await fetch('http://localhost:8080/api/dev/reset-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'trollcity2025@gmail.com',
        newPassword: 'Trollcity95@'
      })
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✓ Account successfully reset!');
      console.log(`✓ Email: ${data.message.split(' ')[2]}`);
      console.log(`✓ New password: Trollcity95@`);
    } else {
      console.log('\n✗ Failed to reset account');
      console.log(data.message);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
};

resetAccount();
