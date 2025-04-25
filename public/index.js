document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sendButton').addEventListener('click', sendMessage);
  getFolderMessages('Sent');
  getFolderMessages('Received');
});

async function sendMessage() {
  const sendButton = document.getElementById('sendButton');
  sendButton.disabled = true;

  const sender = document.getElementById('senderEmail').value;
  const recipient = document.getElementById('recipientEmail').value;
  const content = document.getElementById('messageContent').value;

  try {
    const response = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      body: JSON.stringify({ sender, recipient, content }),
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Fejl ved afsendelse');
    }

    console.log('Besked sendt succesfuldt:', result);
    document.getElementById('messageContent').value = '';
    await getFolderMessages('Sent');
  } catch (error) {
    console.error('Fejl ved afsendelse:', error);
    alert('Kunne ikke sende besked: ' + error.message);
  } finally {
    sendButton.disabled = false;
  }
}

async function getFolderMessages(folderName) {
  const email = document.getElementById('senderEmail').value;
  try {
    const response = await fetch(
      `/.netlify/functions/chat?action=getFolderMessages&email=${encodeURIComponent(email)}&folderName=${folderName}`
    );
    const messages = await response.json();

    console.log(`Hentede beskeder for ${folderName}:`, messages);

    const messageList = document.getElementById(`${folderName.toLowerCase()}Messages`);
    messageList.innerHTML = '';
    messages.forEach(msg => {
      const li = document.createElement('li');
      li.innerHTML = `
        ${msg.content}
        <button class="decryptButton" data-message-id="${msg._id}">Dekrypt</button>
      `;
      messageList.appendChild(li);
    });
  } catch (error) {
    console.error(`Fejl ved hentning af ${folderName} beskeder:`, error);
  }
}

function decryptMessage(messageId, encryptedContent) {
  console.log('Dekrypterer besked ID:', messageId);
  try {
    const key = prompt('Indtast dekrypteringsnøgle');
    if (!key) throw new Error('Ingen nøgle angivet');
    const bytes = CryptoJS.AES.decrypt(encryptedContent, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error('Ugyldig nøgle eller indhold');
    console.log('Dekrypteret besked:', decrypted);
    alert('Dekrypteret besked: ' + decrypted);
    return decrypted;
  } catch (error) {
    console.error('Dekrypteringsfejl:', error);
    alert('Dekryptering mislykkedes: ' + error.message);
    return null;
  }
}

document.addEventListener('click', (event) => {
  if (event.target.classList.contains('decryptButton')) {
    console.log('Dekrypt-knap klikket');
    const messageId = event.target.dataset.messageId;
    const encryptedContent = event.target.parentElement.textContent.trim().split(' ')[0];
    decryptMessage(messageId, encryptedContent);
  }
});
