import { useState, useEffect, useRef } from 'react';
import styles from '../styles/Chat.module.css';

const Chat = ({ socket }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('chatMessage', (message) => {
      setMessages(prevMessages => [...prevMessages, message]);
    });

    return () => {
      socket.off('chatMessage');
    };
  }, [socket]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    const messageText = inputMessage.trim();
    if (messageText && socket) {
      socket.emit('chatMessage', messageText);
      setInputMessage('');
    }
  };

  return (
    <div className={styles.chatContainer}>
      <h2 className={styles.chatHeader}>Chat</h2>
      
      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <p className={styles.emptyMessage}>No messages yet. Start the conversation!</p>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={styles.message}>
              <span className={styles.user}>{message.user}: </span>
              <span className={styles.text}>{message.text}</span>
              <span className={styles.time}>{message.time}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={sendMessage} className={styles.inputForm}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type a message..."
          className={styles.input}
        />
        <button type="submit" className={styles.sendButton}>Send</button>
      </form>
    </div>
  );
};

export default Chat;