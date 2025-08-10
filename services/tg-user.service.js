

class TgUserService {
    constructor(userModel) {
        this.userModel = userModel
    }

    async setUser(ctx) {
        const tgUser = await this.userModel.findOne({ tgId: String(ctx.update.message.from.id) })

        if (tgUser) {
            return tgUser
        }

        const newTgUser = await this.userModel.create({
            tgId: String(ctx.update.message.from.id),
            name: String(ctx.update.message.from.username)
        })

        await newTgUser.save()

        return newTgUser
    }
}

module.exports = { TgUserService };