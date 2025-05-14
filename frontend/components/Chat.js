import { useState, useEffect, useRef } from 'react';
import styles from '../styles/Chat.module.css';

const Chat = ({ socket }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [pingResult, setPingResult] = useState(null);
  const [isPinging, setIsPinging] = useState(false);
  const messagesEndRef = useRef(null);
  const pingStartTimeRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('chatMessage', (message) => {
      setMessages(prevMessages => [...prevMessages, message]);
    });

    // Handle server messages
    socket.on('serverMessage', (data) => {
      // Don't show heartbeat messages in chat unless they contain actual information
      if (data.isHeartbeat) {
        // Just log to console instead of adding to messages
        console.log('Heartbeat received:', data.message);
        return;
      }
      
      setMessages(prevMessages => [
        ...prevMessages, 
        {
          user: 'SERVER',
          text: data.message,
          time: new Date(data.timestamp).toLocaleTimeString(),
          isServer: true
        }
      ]);
    });

    // Handle pong responses
    socket.on('pong', (data) => {
      const latency = Date.now() - pingStartTimeRef.current;
      setPingResult(`Ping: ${latency}ms`);
      setIsPinging(false);
    });

    return () => {
      socket.off('chatMessage');
      socket.off('serverMessage');
      socket.off('pong');
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

  // Handle ping button click
  const handlePing = () => {
    if (!socket || isPinging) return;
    
    setIsPinging(true);
    setPingResult('Pinging...');
    pingStartTimeRef.current = Date.now();
    socket.emit('ping');
    
    // Set a timeout to reset if no response
    setTimeout(() => {
      if (isPinging) {
        setPingResult('Ping timeout');
        setIsPinging(false);
      }
    }, 5000);
  };

  return (
    <div className={styles.chatContainer}>
      <h2 className={styles.chatHeader}>
        Chat
        <span className={styles.userCount}>
          {socket && socket.connected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </h2>
      
      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <p className={styles.emptyMessage}>No messages yet. Start the conversation!</p>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index} 
              className={`${styles.message} ${message.isAdmin ? styles.adminMessage : ''} ${message.isServer ? styles.serverMessage : ''}`}
            >
              <span className={styles.user}>{message.user}: </span>
              <span className={styles.text}>{message.text}</span>
              <span className={styles.time}>{message.time}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className={styles.pingContainer}>
        <button 
          onClick={handlePing} 
          disabled={isPinging}
          className={styles.pingButton}
        >
          Ping
        </button>
        {pingResult && <span className={styles.pingResult}>{pingResult}</span>}
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