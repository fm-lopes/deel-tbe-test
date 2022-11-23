const express = require('express');
const bodyParser = require('body-parser');
const {sequelize, Profile} = require('./model')
const {getProfile} = require('./middleware/getProfile');
const { Op } = require('sequelize');
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

const profileService = require('./service/profile.service');

require('express-async-errors'); // handle promise exceptions for every endpoint

/**
 * FIX ME!
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile ,async (req, res) =>{

    const {Contract} = req.app.get('models')
    const {id} = req.params
    const profileId = req.get('profile_id');
    const contract = await Contract.findOne({
        where: {
            id,
            [Op.or]: {
                ContractorId: profileId,
                ClientId: profileId
            }
        }
    });

    if(!contract) return res.status(404).end()
    res.json(contract)
})

app.get('/contracts', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models');
    
    const profileId = req.get('profile_id');
    const contracts = await Contract.findAndCountAll({ // findAndCountAll for count and future pagination
        where: {
            [Op.not]: { status: 'terminated' },
            [Op.or]: { ContractorId: profileId, ClientId: profileId }
        }
    })

    res.json(contracts);
})

app.get('/jobs/unpaid', getProfile, async (req, res) => {
    const { Job, Contract } = req.app.get('models');
    
    const profileId = req.get('profile_id');

    const jobs = await Job.findAndCountAll({
        include: [{
            model: Contract,
            where: { 
                status: 'in_progress',
                [Op.or]: { ContractorId: profileId, ClientId: profileId }
            }
        }],    
        where: { paid: false }
    });

    res.json(jobs);
})

app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
    // Pay for a job, a client can only pay if his balance >= the amount to pay. The amount should be moved from the client's balance to the contractor balance.

    const { Job, Contract } = req.app.get('models')
    const { job_id } = req.params
    const profileId = req.get('profile_id')

    const job = await Job.findOne({ 
        include: [{
            model: Contract,
            include: ['Contractor'],
            where: { 
                [Op.or]: { ClientId: profileId } // prevent access to not allowed contracts 
            }
        }],
        where: { id: job_id }
    })

    if (!job)
        return res.status(404).end();

    if (req.profile.balance < job.price)
        return res.status(400).send('Not enough balance for this job');

    job.paid = true;

    const [,,updatedJob] = await sequelize.transaction(async transaction => {
        return Promise.all([
            profileService.addBalance(req.profile, -job.price, transaction),
            profileService.addBalance(job.Contract.Contractor, job.price, transaction),
            job.save({ transaction }),
        ])
    })

    res.json({ job: updatedJob })
})

app.post('/balances/deposit/:userId', getProfile, async (req, res) => {
    // Deposits money into the the the balance of a client, a client can't deposit more than 25% his total of jobs to pay. (at the deposit moment)

    const { Profile, Contract, Job } = req.app.get('models')
    const { userId } = req.params
    const { depositValue } = req.query

    if (!depositValue) return res.status(400).end()

    const user = await Profile.findByPk(userId, { where: { type: 'client' }})

    if (!user) return res.status(404).end()

    const jobsToPay = await Job.findAll({
        include: [{ 
            model: Contract,
            where: { ClientId: userId }
        }],
        where: { paid: false }
    })

    const amountToPay = jobsToPay.reduce((acc, job) => acc + job.price, 0)

    if (depositValue > (amountToPay * .25))
        return res.status(400).send({ message: 'amount over 25% of total jobs to pay' })

    const updated = await profileService.addBalance(user, depositValue);

    res.json(updated)
})

app.get('/admin/best-profession', getProfile, async (req, res) => {
    // Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.

    const { Job, Contract, Profile } = req.app.get('models');
    const { start, end } = req.query
    
    const maxPaidProfession = await Contract.findAll({
        attributes: [
            'Contractor.profession',
            [sequelize.fn('sum', sequelize.col('Jobs.price')), 'total_amount']
        ],
        include: [{
            model: Profile,
            as: 'Contractor',
            attributes: ['profession'],
        }, {
            attributes: [],
            model: Job,
            where: { 
                paid: true,
                paymentDate: { [Op.between]: [new Date(start), new Date(end)]}
            }
        }],
        group: ['Contractor.profession'],
        order: [['total_amount', 'DESC']],
        limit: 1,
        subQuery: false
    })

    res.json({ maxPaidProfession })
})

app.get('/admin/best-clients', getProfile, async (req, res) => {
    // returns the clients the paid the most for jobs in the query time period. limit query parameter should be applied, default limit is 2.

    const { Job, Contract, Profile } = req.app.get('models');
    const { start, end, limit = 2 } = req.query
    
    const clientsInRange = await Contract.findAll({
        attributes: [
            'id',
            [sequelize.literal(`Client.firstName || ' ' || Client.lastName`), 'fullName'],
            [sequelize.fn('sum', sequelize.col('Jobs.price')), 'paid']
        ],
        include: [{
            attributes: [],
            model: Profile, 
            as: 'Client'
        }, {
            attributes: [],
            model: Job,
            where: { 
                paid: true,
                paymentDate: { [Op.between]: [new Date(start), new Date(end)]}
            }
        }],
        group: ['Client.id'],
        order: [['paid', 'DESC']],
        limit,
        subQuery: false
    })

    res.json({ clientsInRange })
})


module.exports = app;
