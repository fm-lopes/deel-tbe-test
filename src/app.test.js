const request = require('supertest');

const app = require('./app');

describe('GET /', () => {
    it('GET /contracts/1 => allowed contract', () => {
        return request(app)
            .get('/contracts/1')
            .set({ profile_id: 1 })
            .then((response) => {
                expect(response.statusCode).toBe(200);
                expect(response.body.id).toBe(1);
            });
    })

    it('GET /contracts/1 => not allowed contract', () => {
        return request(app)
            .get('/contracts/1')
            .set({ profile_id: 2 })
            .then((response) => {
                expect(response.statusCode).toBe(404);
            });
    })

    it('GET /contracts => list contracts', () => {
        return request(app)
            .get('/contracts')
            .set({ profile_id: 1 })
            .then((response) => {
                expect(response.statusCode).toBe(200);
                expect(response.body.rows).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            id: expect.any(Number),
                            terms: expect.any(String),
                            status: expect.any(String),
                            createdAt: expect.any(String),
                            updatedAt: expect.any(String),
                            ContractorId: expect.any(Number),
                            ClientId: expect.any(Number)
                        }),
                    ])
                );
            });
    })

    it('GET /jobs/unpaid => list unpaid jobs', () => {
        return request(app)
            .get('/jobs/unpaid')
            .set({ profile_id: 2 })
            .then((response) => {
                expect(response.statusCode).toBe(200);
                expect(response.body.rows).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            paid: false
                        }),
                    ])
                );
            });
    })

    it('POST /jobs/:job_id/pay => pay for a job', () => {
        return request(app)
            .post('/jobs/1/pay')
            .set({ profile_id: 1 })
            .then((response) => {
                expect(response.statusCode).toBe(200);
                expect(response.body).toEqual(
                    expect.objectContaining({
                        job: expect.objectContaining({
                            paid: true
                        }),
                    })
                );
            });
    })

    it('POST /balances/deposit/:userId => deposit amount on users balance', () => {
        return request(app)
            .post('/balances/deposit/2?depositValue=10')
            .set({ profile_id: 1 })
            .then((response) => {
                expect(response.statusCode).toBe(200);
            });
    })

    it('POST /balances/deposit/:userId => deposit amount over 25%', () => {
        return request(app)
            .post('/balances/deposit/2?depositValue=1000')
            .set({ profile_id: 1 })
            .then((response) => {
                expect(response.statusCode).toBe(400);
            });
    })

    it('GET /admin/best-profession => returns most paid profession in range', () => {
        return request(app)
            .get('/admin/best-profession?start=2020-08-15&end=2020-08-15')
            .set({ profile_id: 1 })
            .then((response) => {
                expect(response.statusCode).toBe(200);
                
            });
    })

    it('GET /admin/best-clients => returns most paying client in range', () => {
        return request(app)
            .get('/admin/best-clients?start=2020-08-14&end=2022-08-16')
            .set({ profile_id: 1 })
            .then((response) => {
                expect(response.statusCode).toBe(200);
                
            });
    })

})