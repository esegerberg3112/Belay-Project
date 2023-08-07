import string
import random
import sqlite3
from flask import *
import bcrypt
from datetime import datetime

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.static_folder = 'static'


@app.teardown_appcontext
def close_connection(exception):
    """ Function to close connection to database"""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

@app.route('/')
@app.route('/login')
@app.route('/signup')
@app.route('/profile')
@app.route('/message/<message_id>')
@app.route('/channel/<channel_id>')
def index(channel_id=None, message_id=None):
    """ Serve the HTML page when the Flask server is started"""
    return app.send_static_file("index.html")

@app.errorhandler(404)
def page_not_found(e):
    return app.send_static_file('404.html'), 404


# -------------------------------- DATABASE FUNCTIONS ----------------------------------
def get_db():
    """ Function to connect to SQLite database """
    db = getattr(g, '_database', None)

    if db is None:
        db = g._database = sqlite3.connect('db/belay.sqlite3')
        db.row_factory = sqlite3.Row
        setattr(g, '_database', db)
    return db


def query_db(query, args=(), one=False):
    """ Function to perform sanitized database queries """
    db = get_db()
    cursor = db.execute(query, args)
    rows = cursor.fetchall()
    db.commit()
    cursor.close()
    if rows:
        if one:
            return rows[0]
        return rows
    return None


# -------------------------------- HELPER FUNCTIONS ----------------------------------
def new_user():
    """ Function to generate a random new user """
    name = "Unnamed User #" + ''.join(random.choices(string.digits, k=6))
    password = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
    api_key = ''.join(random.choices(string.ascii_lowercase + string.digits, k=40))

    # hash and salt the password and store in the database
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    u = query_db('insert into users (name, password, api_key) ' +
        'values (?, ?, ?) returning id, name, password, api_key',
        (name, hashed_pw, api_key),
        one=True)
    return api_key


def check_api_token(request_token):
    """ Function to check if user gives valid API token for any requests """
    valid_token = query_db('select id from users where api_key = ?', [request_token], one=True)
    # if API token doesn't exist
    if valid_token is None:
        return False, ""
    else:
        user_id = valid_token['id']
        return True, user_id


# -------------------------------- API Signup/Login ROUTES ----------------------------------
@app.route('/api/signup', methods=['POST'])
def sign_up():
    """ User sign up endpoint that randomly generates a username, password and API token """
    api_key = new_user()
    return {"api_key": api_key}, 200


@app.route('/api/login', methods=['POST'])
def login():
    """ User login endpoint """  
    provided_username = request.headers.get('username')
    provided_password = request.headers.get('password')

    # make db query
    user_query = query_db('select password, api_key from users where name = ?', [provided_username], one=True)

    # if username doesn't exist
    if not user_query:
        return {}, 404
    else:
        db_hashed_password = user_query['password']
        api_token = user_query['api_key']

        # if password matches hash, must be the correct password and return api token
        if bcrypt.checkpw(provided_password.encode("utf-8"), db_hashed_password):
            return {"api_key": api_token}, 200
        else:
            return {}, 401


# -------------------------------- API Update User Information ROUTES ----------------------------------
@app.route('/api/users/name', methods=['POST'])
def update_username():
    """ Endpoint to update a user's username """
    request_body = request.get_json()
    request_api_token = request.headers.get('Authorization')

    # check if their submission is a valid API token and get their username
    user_query = query_db('select id from users where api_key = ?', [request_api_token], one=True)
    if user_query:
        user_id = user_query['id']
        query_db('UPDATE users SET name = ? WHERE id = ?', [request_body.get('newUsername'), user_id])
        return {}, 200
    else:
        return {}, 401


# POST to change the user's password
@app.route('/api/users/password', methods=['POST'])
def update_user_password():
    """ Endpoint to update a user's password """
    request_body = request.get_json()
    new_password = request_body.get('newUserPassword')
    request_api_token = request.headers.get('Authorization')
    
    # check if their submission is a valid API token and get their username
    user_query = query_db('select name from users where api_key = ?', [request_api_token], one=True)
    if user_query:
        user_name = user_query['name']
        hashed_pw = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        query_db('UPDATE users SET password = ? WHERE name = ?', [hashed_pw, user_name])
        return {}, 200
    else:
        return {}, 401

# -------------------------------- API Channels ROUTES ----------------------------------
@app.route('/api/channels/new', methods=['POST'])
def create_new_channel():
    """ Endpoint to create a new channel with a random name """
    request_api_token = request.headers.get('Authorization')
    validation, id = check_api_token(request_api_token)

    if not validation:
        return {}, 401
    else:
        name = "Unnamed Channel " + ''.join(random.choices(string.digits, k=6))
        channel = query_db('insert into channels (name) values (?) returning id', [name], one=True)

        # also insert it into unread without a time stamp since it hasn't been clicked on yet
        query_db('insert into unread (user_id, channel_id) VALUES(?, ?)', [id, channel['id']], one=True)
        return {"channel_name": name, "channel_id": channel['id']}, 200

@app.route('/api/channels', methods=['GET'])
def get_all_channels():
    """ Endpoint to get all channels in the database """
    request_api_token = request.headers.get('Authorization')
    
    validation, id = check_api_token(request_api_token)

    if not validation:
        return {}, 401
    else:
        channels_query = query_db('SELECT id, name FROM channels')
        all_channels = {}
        # check if there are any existing channels
        if channels_query:
            # parse all rows from db and add to a dictionary
            for row in channels_query:
                all_channels[row['id']] = row['name']
            return jsonify(all_channels), 200
        else:
            return jsonify({}), 200
        
@app.route('/api/channels/rename', methods=['POST'])
def change_channel_name():
    """ Endpoint to rename a channel """
    request_body = request.get_json()
    request_api_token = request.headers.get('Authorization')
    validation, id = check_api_token(request_api_token)

    if not validation:
        return {}, 401
    else:
        new_name = request_body.get('name')
        channel_id = request_body.get('channel_id')
        query_db('UPDATE channels SET name = ? WHERE id = ?', [new_name, channel_id])
        return {}, 200
        

# -------------------------------- API Messages ROUTES ----------------------------------

@app.route('/api/messages', methods=['POST'])
def post_channel_message():
    """ Post a new message to a specific channel provided in the request body """
    request_body = request.get_json()
    request_api_token = request.headers.get('Authorization')

    validation, user_id = check_api_token(request_api_token)
    # if current users api token doesn't match the api token given in the API request
    if not validation:
        return {}, 403
    else:
        message = request_body.get('body')
        channel_id = request_body.get('channel_id', None)
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        query_db('insert into messages (user_id, channel_id, body, posted_time) VALUES(?, ?, ?, ?)', [user_id, channel_id, message, current_time], one=True)
        return {}, 200

@app.route('/api/messages/<int:channel_id>', methods=['GET'])
def get_channel_messages(channel_id):
    """ Get all messages in a channel """
    # check authorization for user
    request_api_token = request.headers.get('Authorization')

    validation, id = check_api_token(request_api_token)
    # if current users api token doesn't match the api token given in the API request
    if not validation:
        return {}, 403
    else:
        # if it's valid, get all the messages (NOT replies) and return them as a json object
        select_messages = query_db(
            'SELECT messages.id as mssg_id, users.name as username, messages.body as body FROM messages left outer join users on messages.user_id = users.id where (channel_id = ?) AND (replied_to = ? OR replied_to is ?)', [int(channel_id), "", None])
        all_messages = {}
        # check if there are any existing messages for this current room
        if select_messages:
            # parse all rows from db and add to a Python dictionary
            for row in select_messages:
                all_messages[row['mssg_id']] = {
                    "username": row['username'],
                    "body": row['body']
                }
                # check if each message has any replies
                num_replies = query_db('SELECT COUNT(*) FROM messages WHERE replied_to = ? AND channel_id = ?', [row['mssg_id'], channel_id], one=True)
                all_messages[row['mssg_id']]['replies_count'] = num_replies[0]
            return jsonify(all_messages), 200
        # no messages in this channel
        else:
            return jsonify({}), 200
        

# -------------------------------- API Thread/Replies ROUTES ----------------------------------

@app.route('/api/replies', methods=['POST'])
def post_reply():
    """ Post a new reply to a specific channel provided in the request body """
    request_body = request.get_json()
    request_api_token = request.headers.get('Authorization')

    validation, user_id = check_api_token(request_api_token)
    # if current users api token doesn't match the api token given in the API request
    if not validation:
        return {}, 403
    else:
        message = request_body.get('body')
        message_id = request_body.get('message_id')
        channel_id = request_body.get('channel_id')
        query_db('insert into messages (user_id, channel_id, body, replied_to) VALUES (?, ?, ?, ?)', [user_id, channel_id, message, message_id], one=True)
        return {}, 200

@app.route('/api/replies/<int:message_id>', methods=['GET'])
def get_message_replies(message_id):
    """ Get all messages in a channel """
    # check authorization for user
    request_api_token = request.headers.get('Authorization')
    # message ID that the user replied to
    message_id = request.headers.get('message_id')
    channel_id = request.headers.get('channel_id')

    validation, id = check_api_token(request_api_token)
    # if current users api token doesn't match the api token given in the API request
    if not validation:
        return {}, 403
    else:
        select_replies = query_db(
            'SELECT messages.id as id, users.name as username, messages.body as body FROM messages left outer join users on messages.user_id = users.id where (replied_to = ? AND channel_id = ?)', [message_id, channel_id])
        all_messages = {}
        # check if there are any existing messages for this current room
        if select_replies:
            # parse all rows from db and add to a Python dictionary
            for row in select_replies:
                all_messages[row['id']] = {
                    "username": row['username'],
                    "body": row['body']
                }
            return jsonify(all_messages), 200
        # no messages in this channel
        else:
            return jsonify({}), 200
        
# -------------------------------- API Unread Messages ROUTES ----------------------------------
@app.route('/api/unreads/update', methods=['POST'])
def update_last_seen_time():
    """ Update the last time in which the user has seen the messages of a given channel """
    # check authorization for user
    request_api_token = request.headers.get('Authorization')
    request_body = request.get_json()
    channel_id = request_body.get('channel_id')

    validation, user_id = check_api_token(request_api_token)
    # if current users api token doesn't match the api token given in the API request
    if not validation:
        return {}, 403
    else:
        last_seen_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # need to check if this is the first time the channels been seen, cause need to use INSERT not UPDATE
        see_if_exists = query_db('SELECT last_seen FROM unread WHERE user_id = ? AND channel_id = ?', [user_id, channel_id], one=True)
        
        # if it didn't fail, use UPDATE
        if see_if_exists:
            query_db('UPDATE unread SET last_seen = ? where user_id = ? AND channel_id = ?', [last_seen_time, user_id, channel_id])
        else:
            query_db('insert into unread (user_id, channel_id, last_seen) VALUES(?, ?, ?)', [user_id, channel_id, last_seen_time], one=True)

        return {}, 200

@app.route('/api/unreads/count', methods=['GET'])
def get_all_unread_counts():
    """ Function to get number of unread messages (not replies) for each channel """
    # check authorization for user
    request_api_token = request.headers.get('Authorization')
    validation, user_id = check_api_token(request_api_token)

    if not validation:
        return {}, 403
    else:
        unread_counts_query = query_db(
            """
            SELECT m.channel_id, COUNT(*) as message_count
            FROM messages AS m
            LEFT JOIN unread AS u ON m.channel_id = u.channel_id
            WHERE m.user_id != ?
            AND m.posted_time > COALESCE(u.last_seen, '1600-12-31 00:00:00')
            GROUP BY m.channel_id
            """, [user_id]
        )
        all_unreads = {}
        if unread_counts_query:
            for row in unread_counts_query:
                all_unreads[row['channel_id']] = row['message_count']
            return jsonify(all_unreads), 200
        else:
            return jsonify({}), 200
        
# -------------------------------- API Reaction ROUTES ----------------------------------
@app.route('/api/reactions', methods=['POST'])
def add_new_reaction():
    """ Add a new message reaction to the reactions table """
    request_body = request.get_json()
    request_api_token = request.headers.get('Authorization')

    validation, user_id = check_api_token(request_api_token)
    # if current users api token doesn't match the api token given in the API request
    if not validation:
        return {}, 403
    else:
        emoji = request_body.get('emoji')
        message_id = request_body.get('message_id')

        see_if_exists = query_db('SELECT id FROM reactions WHERE user_id = ? AND message_id = ? AND emoji = ?', [user_id, message_id, emoji], one=True)
        
        # if it didn't fail, use UPDATE
        if see_if_exists:
            return {}, 200
        else:
            query_db('insert into reactions (emoji, message_id, user_id) VALUES(?, ?, ?)', [emoji, message_id, user_id], one=True)
        user_query = query_db('select name from users where id = ?', [user_id], one=True)
        return {"user_name": user_query['name']}, 200