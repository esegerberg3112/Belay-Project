create table users (
  id INTEGER PRIMARY KEY,
  name VARCHAR(40) UNIQUE,
  password VARCHAR(40),
  api_key VARCHAR(40)
);

create table channels (
    id INTEGER PRIMARY KEY,
    name VARCHAR(40) UNIQUE
);

create table messages (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  channel_id INTEGER,
  body TEXT,
  replied_to INTEGER,
  posted_time DATETIME CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(channel_id) REFERENCES channels(id)
);

create table reactions (
    id INTEGER PRIMARY KEY,
    emoji TEXT, --will store as unicode
    message_id INTEGER, -- ID of message/reply that user is emojiing
    user_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

create table unread (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    channel_id INTEGER, 
    count INTEGER DEFAULT 0,
    last_seen DATETIME CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(channel_id) REFERENCES channels(id)
);