import express from 'express'
import { searchMentors } from '../controllers/mentor.controller'


const router = express.Router()


router.get('/search',searchMentors)


export default router


