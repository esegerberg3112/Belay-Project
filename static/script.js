// ---------- Default Page for when user accesses the site ----------
function PageAccess() {
    // Define state for whether the user is logged in already, on the login page, or on the change channel name page
    const [userLoggedIn, setLoggedIn] = React.useState(localStorage.getItem('esegerberg_belay_session_token'));
    const [checkProfile, setProfileStatus] = React.useState(false);
    const [channelName, setChannelName] = React.useState(null);

    // handler for if the user wants to go to the Profile page
    function handleCheckProfile(){
        setProfileStatus(!checkProfile);
    }

    // handle if user wants to change channel name
    function handleNewChannelName( i = null){
        if (i) {
            setChannelName(i);
        }else {
            setChannelName(null);
        }
    }

    // when they user logs in, update state the session token from localStorage
    function handleLoginClick(){
        setLoggedIn(localStorage.getItem('esegerberg_belay_session_token'));
    }

    // if user wants to change the name of a channel
    if (channelName) {
        return <ChangeChannelName channelId={channelName} onChangeChannelClick={(i) => handleNewChannelName(i)} />
    }

    // if user wants to go to Profile page, call that component and Render HTML
    if (checkProfile) {
        return <ProfilePage onProfileClick={handleCheckProfile} onLoginClick={handleLoginClick} />
    }
    
    // based on if user is logged in or not, show Login page or Home page
    return userLoggedIn ? <HomePage onChangeChannelClick={(i) => handleNewChannelName(i)} onLoginClick={handleLoginClick} onProfileClick={handleCheckProfile}/> : <LoginPage onLoginClick={handleLoginClick}/>
}


// Component to handle the displaying of content on the main page, i.e. of Channels/Messages/Replies
function HomePage({ onChangeChannelClick, onProfileClick, onLoginClick }) {
    // States for currentChannnel user is in
    const [channel, setChannel] = React.useState(null);

    // State for if displaying messages
    const [messages, setMessages] = React.useState(null);

    // State for if showing replies
    const [replies, setReplies] = React.useState(null);

    // function to log user out from home page
    function logout(){
        localStorage.removeItem('esegerberg_belay_session_token');
        // update parent/inhereted states
        onLoginClick();
    }

    // handle when user clicks the X to close the message pane
    function handleMessageClose (channelId){
        setMessages(null);
        setReplies(null);
        const currentChannel = document.querySelector(`#channel-${channelId}`)
        currentChannel.classList.remove("highlighted-channel")
    }

    // handle new channel name, send to that page
    function goToChangeChannelName (i){
        onChangeChannelClick(i);
    }

    // handle when a user wants to reply to a message
    function handleReplyClick (messageId) {
        setReplies(messageId);
    }

    // handle when a user wants to close out their replies for a message
    function handleReplyClose (messageId) {
        setReplies(null);
    }

    // handle when a channel is clicked on
    function handleChannelClick (channelId) {
        // highlight the current channel thats clicked
        const allChannels = document.querySelectorAll(".channel-instance");
        for (const each of allChannels) {
            try{
                each.classList.remove("highlighted-channel");
            }
            catch (e){
                console.log(e)
            }
        }
        if (channelId === channel) {
            setChannel(null);
            // clear out message state
            setMessages(null);
            setReplies(null);
        } else{
            // clear out message state
            setMessages(null);
            setReplies(null);
            // set the current channel, and highlight it in channels list
            setChannel(channelId);
            const currentChannel = document.querySelector(`#channel-${channelId}`)
            currentChannel.classList.add("highlighted-channel")
            // setMessage state so it knows to render messages
            setMessages(channelId);
        }
        return;
    }

    // return JSX
    return (
        <div className="home-page">
            <div className="home-header">
                <div className="home-buttons">
                    <button onClick={onProfileClick}>Profile</button>
                    <button onClick={logout}>Logout</button>
                </div>
                <div className="website-title">
                    <a>Belay</a>
                </div>
            </div>
            <div className="home-content">
                    <Channels onChangeChannelName={(channelId) => goToChangeChannelName(channelId)} onChannelClick={(channelId) => handleChannelClick(channelId)}/>
                    {messages ? <Messages onReplyClick={(messageId) => handleReplyClick(messageId)} onMessageExit={(channelId) => handleMessageClose(channelId)} channelId={messages}/> : null}    
                    {replies ?  <Replies channelId={messages} messageId={replies} onReplyExit={(messageId) => handleReplyClose(messageId)}/> : null}
            </div>
        </div>
    )
}

// ---------- React component to handle Change Channels Page ----------------
function ChangeChannelName ({ channelId, onChangeChannelClick }) {
    // function to change channel name in the database
    async function changeChannelName(channelId) {
        const requestParams = {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
            },
            body: JSON.stringify({
                "channel_id": channelId,
                "name": document.querySelector('.changeChannelName').value
            })
        };
        const apiResponse = await fetch('/api/channels/rename', requestParams);
        if (apiResponse.status === 200) {
            const data = await apiResponse.json();
            // successfully changed password, navigate back to home screen
            onChangeChannelClick(null);
        } else {
            alert ("That channel name is already taken.")
            console.log(apiResponse.status)
            console.log(apiResponse.statusText)
        }
    }
    return (
        <div className="profile">
            <div className="auth container">
                <h3>Channel Profile</h3>
                <div className="alignedForm">
                    <label>Change Channel Name: </label>
                    <input className="changeChannelName" name="channel"/>
                    <button onClick={() => changeChannelName(channelId)}>Update</button><br />
                </div>
            </div>
        </div>
    )
}


// ---------- React component to handle Channels----------------
function Channels({ onChangeChannelName, onChannelClick}) {
    const [channelList, setChannelList] = React.useState({});

    // track the current number of unread messages for each channel
    const [unreads, setUnreads] = React.useState([])

    // function to update the name of a channel
    function handleChangingChannelName( channelId ){
        onChangeChannelName(channelId)
    }

     // function to create a single channel
     async function createChannel () {
        // create channel and the modify state to have getChannelsList run again
        const requestParams = {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
            }
        };

        try {
            const apiResponse = await fetch('/api/channels/new', requestParams);
            if (apiResponse.status === 200) {
                const data = await apiResponse.json();
                
                // call getChannelsList to pull down the new list, and update the state
                getChannelsList();
            } else {
                console.log(apiResponse.status)
                console.log(apiResponse.statusText)
            }
        } catch (e) {
            console.log(e)
            return e;
        }
    }

    // function to get a list of all current channels when the page loads
    async function getChannelsList(){
        // reset the current channels state
        setChannelList({});

        const requestParams = {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
            }
        };
        try {
            const apiResponse = await fetch('/api/channels', requestParams);
            if (apiResponse.status === 200) {
                const data = await apiResponse.json();
                
                // update the state with the current list of channels
                setChannelList(data);
            } else {
                console.log(apiResponse.status)
                console.log(apiResponse.statusText)
            }
        } catch (e) {
            console.log(e)
            return e;
        }
    }

    // function to get the unreadCount for each 
    async function getChannelUnreads() {
        setUnreads({})
        // need to use an [][ for state
        // parse keys (i.e. channel ID's) from API response
        // order them by increasing INT value
        const requestParams = {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
            }
        };
        const apiResponse = await fetch('/api/unreads/count', requestParams);
        if (apiResponse.status === 200) {
            const newCounts = await apiResponse.json();
            console.log(newCounts);
            
            // update the state with the current list of channels
            // Update the state with the new counts
            setUnreads((prevCounts) => ({
                ...prevCounts,
                ...newCounts,
            }));
        } else {
            console.log(apiResponse.status)
            console.log(apiResponse.statusText)
        }
    }

    // useEffect hook to detect when there is a change to the channels list, and render again
    React.useEffect(() => {
        getChannelsList();
    }, [setChannelList]);

    // useEffect hook for changes in the number of unread messages for any channel
    React.useEffect(() => {
        // Fetch initial unread counts when the component mounts
        getChannelUnreads();
    
        // Set up an interval to periodically fetch updated message counts
        const intervalId = setInterval(getChannelUnreads, 1000);
        return () => clearInterval(intervalId);
      }, []);

    return (
        <div className="channels">
            <span className="channels-title">Channels</span>
            <div className="create-channels">
                <button onClick={createChannel}>Create a Channel</button>
            </div>
            <div className="channels-list">
                {Object.entries(channelList).map(([num, value], index) => (
                    <div className="unique-channel">
                        <a className="channel-instance" onClick={() => onChannelClick(num)} key={`channel-${num}`} id={`channel-${num}`}>{value}</a>
                        <i key={index} onClick={() => handleChangingChannelName(num)} className="fa fa-pencil"></i>
                        {unreads[num] ? <span>{unreads[num]} unread message(s)</span> : null}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ---------- React component to handle Messages ----------------
function Messages({ channelId, onMessageExit, onReplyClick }) {
    const [messageList, setMessageList] = React.useState({});
    const [emojis, setEmojis] = React.useState({});
    
    // async function to post a new message to a channel
    async function postNewMessage(channelId) { 
        const newMessage = document.querySelector('.postMessage').value;
        const requestParams = {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
            },
            body: JSON.stringify({
                "body": newMessage,
                "channel_id": channelId
            })
        };
        const apiResponse = await fetch('/api/messages', requestParams);
        if (apiResponse.status === 200) {
            const data = await apiResponse.json();
            
            // now poll for new messages
            getChannelMessages(channelId);
            document.querySelector('.postMessage').value = "";
            return;
        } else {
            console.log(apiResponse.status)
            console.log(apiResponse.statusText)
        }
    }

    // async function to get all messages in a channel
    async function getChannelMessages(channelId) {
        // reset the current channel messages state
        setMessageList({});
        const requestParams = {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
            }
        };
        // get all messages in this channel
        try {
            const apiResponse = await fetch('/api/messages/' + channelId, requestParams);
            if (apiResponse.status === 200) {
                const data = await apiResponse.json();

                setMessageList(data);
            } else {
                console.log(apiResponse.status)
                console.log(apiResponse.statusText)
            }
        } catch (e) {
            console.log(e)
            return e;
        }
        // after get all the messages, update the last_seen time for this user and this channel's messages
        const nextRequest = {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
            },
            body: JSON.stringify({
                "channel_id": channelId
            })
        };
        const apiResponse = await fetch('/api/unreads/update', nextRequest);
        if (apiResponse.status === 200) {
            const data = await apiResponse.json();
        } else {
            console.log(apiResponse.status)
            console.log(apiResponse.statusText)
        }
        
    }

    // function to add emoji reaction to the database
    async function addReaction (unicodeEmoji, messageId) {
        const requestParams = {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
            },
            body: JSON.stringify({
                "emoji": unicodeEmoji,
                "message_id": messageId
            })
        };
        const apiResponse = await fetch('/api/reactions', requestParams);
        if (apiResponse.status === 200) {
            const data = await apiResponse.json();
            const user = data['user_name']
            // if this emoji has already been reacted to, add this user if they haven't reacted to it before
            setEmojis(prevState => {
                const existingReactions = prevState[messageId] || {}; // Get the existing reactions for the messageId
                const existingUsers = existingReactions[unicodeEmoji] || []; // Get the existing users for the emoji
                
                // Check if the user has already reacted with the emoji
                if (!existingUsers.includes(user)) {
                  const updatedReactions = {
                    ...existingReactions,
                    [unicodeEmoji]: [...existingUsers, user]
                  };
                  
                  return {
                    ...prevState,
                    [messageId]: updatedReactions
                  };
                }
            });
        } else {
            console.log(apiResponse.status)
            console.log(apiResponse.statusText)
        }
        
    }

    const handleReactHover = (event, messageId, unicodeEmoji) => {
        const reactedEmojis = emojis[messageId];
        if (reactedEmojis && reactedEmojis[unicodeEmoji]){
            const tooltipContent = reactedEmojis[unicodeEmoji].join(', ');
            event.target.title = tooltipContent;
        }
    };

    // function to parse an image url out of a message
    function checkImageUrl(text) { 
        // Create a regular expression pattern to match image URLs
        const imageUrlPattern = /\.(gif|jpe?g|tiff?|png|webp|bmp)(\?.*)?$/i;

        // Test if the input value matches the image URL pattern
        if (imageUrlPattern.test(text)) {
            return <img src={text}></img>
        }else {
            return null
        }
    }

    // useEffect hook to detect when there is a change to the messages list, and render again
    // includes when this component is rendered the first time
    React.useEffect(() => {
        getChannelMessages(channelId);
        const pollMessages = setInterval(() => { getChannelMessages(channelId); }, 500)

        return () => {
            clearInterval(pollMessages);
        }
    }, [channelId]);

    return (
        <div className="messages-pane">
            <span className="message-title">Messages</span>
            <button className="exit-messages" onClick={() => onMessageExit(channelId)} type='button'>X</button>
            {messageList && (Object.keys(messageList).length !== 0) ? (
                <div id="messages-list" className="messages-list">
                {Object.keys(messageList).map((key1, index1) => (
                    <div className="message" key={`message-${key1}`} id={`message-${key1}`}>
                        <author>{messageList[key1].username}</author>
                        {checkImageUrl(messageList[key1].body) ? checkImageUrl(messageList[key1].body) : <content>{messageList[key1].body}</content>}
                        <a onMouseEnter={(event) => handleReactHover(event, key1, "&#x1F600")} onClick={() => addReaction("&#x1F600", key1)} key="happy-emoji" id="happy-emoji" className="message-emoji">&#x1F600;</a>
                        <a onMouseEnter={(event) => handleReactHover(event, key1, "&#x1F610")} onClick={() => addReaction("&#x1F610", key1)} key="mid-emoji" id="mid-emoji" className="message-emoji">&#x1F610;</a>
                        <a onMouseEnter={(event) => handleReactHover(event, key1, "&#x1F641")} onClick={() => addReaction("&#x1F641", key1)} key="sad-emoji" id="sad-emoji" className="message-emoji">&#x1F641;</a>
                        <a href="#" onClick={() => onReplyClick(key1)} className="reply-button">{(messageList[key1].replies_count !== 0) ? <span>({messageList[key1].replies_count}) Reply</span>  : <span>Reply</span>}</a>
                    </div>
                ))}
                </div>
                ) : null}
            <div className="post-message">
                <input className="postMessage" name="message" />
                <button onClick={() => postNewMessage(channelId)}>Post Message</button>
            </div>
        </div>
    )
}

// ---------- React component to handle Replies ----------------
function Replies({ channelId, messageId, onReplyExit }) {
    const [replyList, setRepliesList] = React.useState(null);
    const [emojis, setEmojis] = React.useState({});


    // async function to post a new message to a channel
    async function postNewReply(messageId, channelId) { 
        const newReply = document.querySelector('.postReply').value;
        const requestParams = {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
            },
            body: JSON.stringify({
                "body": newReply,
                "message_id": messageId,
                "channel_id": channelId
            })
        };
        const apiResponse = await fetch('/api/replies', requestParams);
        if (apiResponse.status === 200) {
            const data = await apiResponse.json();
            
            // now poll for new messages
            getReplies(messageId);
            document.querySelector('.postReply').value = "";
            return;
        } else {
            console.log(apiResponse.status)
            console.log(apiResponse.statusText)
        }
    }

    // async function to get all replies to a given message
    async function getReplies(messageId, channelId) {
        // reset the current message replies state
        setRepliesList({});
        const requestParams = {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
                'message_id': messageId,
                'channel_id': channelId
            }
        };
        try {
            const apiResponse = await fetch('/api/replies/' + messageId, requestParams);
            if (apiResponse.status === 200) {
                const data = await apiResponse.json();
                // update the state with the current list of replies
                setRepliesList(data);
            } else {
                console.log(apiResponse.status)
                console.log(apiResponse.statusText)
            }
        } catch (e) {
            console.log(e)
            return e;
        }
    }

    // function to add emoji reaction to the database
    async function addReaction (unicodeEmoji, messageId) {
        const requestParams = {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
            },
            body: JSON.stringify({
                "emoji": unicodeEmoji,
                "message_id": messageId
            })
        };
        const apiResponse = await fetch('/api/reactions', requestParams);
        if (apiResponse.status === 200) {
            const data = await apiResponse.json();
            const user = data['user_name']
            // if this emoji has already been reacted to, add this user if they haven't reacted to it before
            setEmojis(prevState => {
                const existingReactions = prevState[messageId] || {}; // Get the existing reactions for the messageId
                const existingUsers = existingReactions[unicodeEmoji] || []; // Get the existing users for the emoji
                
                // Check if the user has already reacted with the emoji
                if (!existingUsers.includes(user)) {
                    const updatedReactions = {
                    ...existingReactions,
                    [unicodeEmoji]: [...existingUsers, user]
                    };
                    
                    return {
                    ...prevState,
                    [messageId]: updatedReactions
                    };
                }
            });
        } else {
            console.log(apiResponse.status)
            console.log(apiResponse.statusText)
        }
        
    }

    const handleReactHover = (event, messageId, unicodeEmoji) => {
        const reactedEmojis = emojis[messageId];
        if (reactedEmojis && reactedEmojis[unicodeEmoji]){
            const tooltipContent = reactedEmojis[unicodeEmoji].join(', ');
            event.target.title = tooltipContent;
        }
    };

    // useEffect hook to detect when there is a change to the replies list, and render again
    // includes when this component is rendered the first time
    React.useEffect(() => {
        getReplies(messageId, channelId);
        const pollReplies = setInterval(() => { getReplies(messageId, channelId); }, 500)

        return () => {
            clearInterval(pollReplies);
        }
    }, [messageId, channelId]);

    return (
        <div className="replies-pane">
            <span className="replies-title">Replies</span>
            <button className="exit-replies" onClick={() => onReplyExit(messageId, channelId)} type='button'>X</button>
            {replyList && (Object.keys(replyList).length !== 0) ? (
                <div id="replies-list" className="replies-list">
                {Object.keys(replyList).map((key1, index1) => (
                    <div className="reply" key={`reply-${key1}`} id={`reply-${key1}`}>
                        <author>{replyList[key1].username}</author>
                        <content>{replyList[key1].body}</content>
                        <a onMouseEnter={(event) => handleReactHover(event, key1, "&#x1F600")} onClick={() => addReaction("&#x1F600", key1)} key="happy-emoji" id="happy-emoji" className="message-emoji">&#x1F600;</a>
                        <a onMouseEnter={(event) => handleReactHover(event, key1, "&#x1F610")} onClick={() => addReaction("&#x1F610", key1)} key="mid-emoji" id="mid-emoji" className="message-emoji">&#x1F610;</a>
                        <a onMouseEnter={(event) => handleReactHover(event, key1, "&#x1F641")} onClick={() => addReaction("&#x1F641", key1)} key="sad-emoji" id="sad-emoji" className="message-emoji">&#x1F641;</a>
                    </div>
                ))}
                </div>
                ) : null}
            <div className="post-reply">
                <input className="postReply" name="reply" />
                <button onClick={() => postNewReply(messageId, channelId)}>Post Reply</button>
            </div>
        </div>
    )
}

// ---------- Profile Page for when user wants to go to their User Profile ----------------
function ProfilePage({ onProfileClick, onLoginClick }) {
    //const [defaultUsername, setDefaultUsername] = React.useState("")

    // send back to home page when user is ready
    function sendToHome(){
        // update parent/inhereted state
        onProfileClick();
    }

    // log user out if they click Logout button
    function logout(){
        localStorage.removeItem('esegerberg_belay_session_token');
        // update parent/inhereted states
        onLoginClick();
        onProfileClick();
    }

    // event handler to update username
    async function updateUsername() {
        const updatedUsername = document.querySelector('.profileUsername').value;

        const requestParams = {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
            },
            body: JSON.stringify({
                "newUsername": updatedUsername
            })
        };

        try {
            const apiResponse = await fetch('/api/users/name', requestParams);
            if (apiResponse.status === 200) {
                document.querySelector('.profileUsername').value = "";
                alert ("Your username was successfully updated.")
                return;
            } else {
                console.log(apiResponse.status)
                console.log(apiResponse.statusText)
            }
        } catch (e) {
            console.log(e)
            return e;
        }
    }

    // event handler to update user password
    async function updatePassword() {
        const password1 = document.querySelector('.profilePass1').value;
        const password2 = document.querySelector('.profilePass2').value;

        // if passwords match
        if (password1 === password2) {
            const requestParams = {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': localStorage.getItem('esegerberg_belay_session_token'),
                },
                body: JSON.stringify({
                    "newUserPassword": password1
                })
            };
            try {
                const apiResponse = await fetch('/api/users/password', requestParams);
                if (apiResponse.status === 200) {
                    document.querySelector('.profilePass1').value = "";
                    document.querySelector('.profilePass2').value = "";
                    alert ("Your password was successfully updated.")
                    return;
                } else {
                    console.log(apiResponse.status)
                    console.log(apiResponse.statusText)
                }
            } catch (e) {
                console.log(e)
                return e;
            }
        }
        // show alert that passwords don't match
        else {
            alert ("Your passwords don't match, please try again!")
            return;
        }
    }

    return (
        <div className="profile">
            <div className="header">
                <h2><a>Welcome to Belay!</a></h2>
                <div className="loggedIn">
                    <a className="welcomeBack">
                    <span className="material-symbols-outlined md-18"></span></a>
                </div>
            </div>
            <div className="auth container">
                <h3>User Profile</h3>
                <div className="alignedForm">
                    <label>Username: </label>
                    <input className="profileUsername" name="username"/>
                    <button onClick={updateUsername}>Update</button><br />
                    <label>Password: </label>
                    <input className="profilePass1" type="password" name="password"/>
                    <button onClick={updatePassword}>Update</button><br />
                    <label>Confirm Password: </label>
                    <input className="profilePass2" type="password" name="repeatPassword"/><br />
                    <button onClick={sendToHome} className="exit goToSplash">Cool, let's go!</button>
                    <button onClick={logout} className="exit logout">Log out</button>
                </div>
            </div>
        </div>
    )
}

// ---------- Login page for when user logs out, or is unauthenticated ----------------
function LoginPage({ onLoginClick }) { 
    // allow user to sign up
    async function signUp() {
        const apiResponse = await fetch('/api/signup', {method: "POST", headers: {Accept: 'application/json',
        'Content-Type': 'application/json',}});
        const data = await apiResponse.json();
        localStorage.setItem('esegerberg_belay_session_token', data['api_key'])

        // update parent/inhereted state
        onLoginClick();
    }

    async function login() {
        // get the input username and password 
        // make a Flask request using an async/await function to wait for a response of success/failure
        const username = document.querySelector('.username');
        const password = document.querySelector('.password');

        const requestParams = {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                username: username.value,
                password: password.value
            }
        };
        try {
            const apiResponse = await fetch('/api/login', requestParams);
            if (apiResponse.status === 200) {
                const data = await apiResponse.json();
                localStorage.setItem('esegerberg_belay_session_token', data['api_key'])

                // update parent/inhereted state
                onLoginClick();
            } else {
                alert ("Your username or password is incorrect, please try again!")
                return;
            }
        } catch (e) {
            console.log(e)
            return e;
        }
    }
    return (
        <div className="accessSite">
            <h3>Enter your username and password to log in:</h3>
            <div className="login">
                <label>Username</label>
                <input className="username" name="username"></input>
                <button key="loginButton" onClick={login}>Login</button>
                <label>Password</label>
                <input className="password" type="password" name="password"/>
            </div>
            <div className="signUp">
                <button key="signUpButton" onClick={signUp}>Sign Up</button>
            </div>
        </div>
    )
}

// initial render page
const rootContainer = document.getElementById("root");
const root = ReactDOM.createRoot(rootContainer);
root.render(<PageAccess />);
