/** *module dependencies */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const { Schema } = mongoose;
const oAuthTypes = ['github'];

/** user schema */
const UserSchema = new Schema({
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  usernamee: { type: String, default: '' },
  provider: { type: String, default: '' },
  hashed_password: { type: String, default: '' },
  authToken: { type: String, default: '' },
  github: {},
});
const validatePresenceOf = (value) => value && value.length;

/** Virtuals */
UserSchema.virtual('password').set(function (password) {
  this._password = password;
  this.hashed_password = this.encryptPassword(password);
}).get(function () {
  return this._password;
});

/** 参数校验 */
UserSchema.path('name').validate(function (name) {
  if (this.skipValidation()) return true;
  return name.length;
}, 'Name cannot be blank');

UserSchema.path('email').validate(function (email) {
  if (this.skipValidation()) return true;
  return email.length;
}, 'Email cannot be blank');

UserSchema.path('email').validate(function (email) {
  return new Promise((resolve) => {
    const User = mongoose.model('User');
    if (this.skipValidation()) return resolve(true);

    // 检查是否新用户 或者 email更新
    if (this.isNew || this.isModified('email')) {
      User.find({ email }).exec((err, users) => resolve(!err && !users.length));
    } else resolve(true);
  });
}, 'Email `{VALUE}` already exists');

UserSchema.methods = {
  authenticate:function(password){
    return bcrypt.compareSync(password,this.hashed_password)
  },

  encryptPassword:function(password){
    if(!password) return ''
    try{
      return bcrypt.hashSync(password,10)
    }catch(err){
      return ''
    }
  },
  /**忽略校验 */
  skipValidation: function(){
    return ~oAuthTypes.indexOf(this.provider)
  }
}


mongoose.model('User', UserSchema);
