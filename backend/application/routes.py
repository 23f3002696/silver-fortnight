from flask import current_app as app, jsonify, request, abort
from .models import User
from flask_jwt_extended import create_access_token, current_user, jwt_required

def role_required(role):
    def wrapper(func):
        @jwt_required()
        def decorator(*args, **kwargs):
            if current_user.role != role:
                return jsonify(message = "You are not authorized to perform this action"), 403
            return func(*args, **kwargs)
        return decorator
    return wrapper

@app.route("/login", methods=["POST"])
def login():
    username = request.json.get("username", None)
    password = request.json.get("password", None)

    user = User.query.filter_by(username=username).one_or_none()
    if not user or not user.password == password:
        return jsonify("Wrong username or password"), 401

    access_token= create_access_token(identity=user)
    return jsonify(access_token=access_token)

# @app.route("/user", methods=["GET"])
# @jwt_required
# def get_user():
#     return jsonify(username=current_user.username, 
#                    email=current_user.email, 
#                    role=current_user.role
#     )

# @app.route("/logout")
# @jwt_required
# def logout():
#     return jsonify({"msg": "Successfully logged out"}), 200

@app.route()
@role_required("admin")
def admin_only():
    return jsonify("This is an admin-only route")

