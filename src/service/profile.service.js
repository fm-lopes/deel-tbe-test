const addBalance = async (profile, quantity, transaction) => {

    if (!profile)
        throw new Error('missing profile')

    profile.balance = (+profile.balance || 0) + +quantity;

    return profile.save({ transaction });
}

module.exports = {
    addBalance
}