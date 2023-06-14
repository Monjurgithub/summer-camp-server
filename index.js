const express = require("express");
const app = express();
const cors = require('cors');
let jwt = require('jsonwebtoken');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_KEY);


app.use(cors())
app.use(express.json())
const verifyJWT = (req, res, next)=>
{
  const authorization = req.headers.authorization;
  if(!authorization)
  {
    return res.status(401).send({error: true, message: 'unauthrized access'})
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded)=>{
    if(error)
    {
      return res.status(403).send({error: true, message: 'token expired'})
    }
    req.decoded = decoded;
    next();
  })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ccinbrr.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const userCollecton = client.db('FLschool').collection('users');
    const classCollecton = client.db('FLschool').collection('addclass');
    const enrollCollecton = client.db('FLschool').collection('enollclass');
    const paymentCollecton = client.db('FLschool').collection('payment');

    app.post("/jwt", (req, res) =>
    {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '7d' })
      res.send({token})
    })

    // verify admin
    const varifyAdmin = async (req, res, next)=>
    {
      const email = req.decoded.email;
      const quary = {email : email}
      const user = await userCollecton.findOne(quary);
      if(user?.role !== "admin")
      {
        return res.status(403).send({error: true, message: "forbiddin message"})
      }
      next();

    }

    // verify Instructor

    const varifyInstructor = async (req, res, next)=>
    {
      const email = req.decoded.email;
      const quary = {email : email}
      const user = await userCollecton.findOne(quary);
      if(user?.role !== "instructor")
      {
        return res.status(403).send({error: true, message: "forbiddin message"})
      }
      next();

    }
    // user post and get
    app.get("/userslist", verifyJWT, varifyAdmin, async (req, res) => {
      const result = await userCollecton.find().toArray();
      res.send(result)
    })


    app.post('/users', async (req, res) => {
      const user = req.body;
      const quary = { email: user.email }
      const ex_user = await userCollecton.findOne(quary);
      if (ex_user) {
        return res.send({ Message: "user already exist" })
      }
      const result = await userCollecton.insertOne(user);
      res.send(result)
    })


    app.patch('/users/role/:id', async (req, res) => {
      const id = req.params.id;;
      const role = req.body;
      const filter = { _id: new ObjectId(id) }
      const update = { $set: role }
      const result = await userCollecton.updateOne(filter, update);
      res.send(result)
    })

    
    app.get("/user", async (req, res) => {
      const { email } = req.query;
      const filter = { email: email }
      const result = await userCollecton.findOne(filter);
      res.send(result)
    })

    // instructor list 

    app.get("/instructor", async(req, res)=>{
      const filter = { role: "instructor" };
      const result = await userCollecton.find(filter).toArray();
      res.send(result);
    })
    // get classes from DB

    app.get("/getallclass", async(req, res)=>{
      const result = await classCollecton.find().toArray()
      res.send(result)
    })

    // added class in DB

    app.post("/addedclass", verifyJWT, varifyInstructor, async(req, res)=>
    {
      const added = req.body;
      const result = await classCollecton.insertOne(added);
      res.send(result)
    })


    // get all select class
    app.get("/userselectclass",verifyJWT, async(req, res)=>{
      const {email} = req.query;

      const decodedEmail = req.decoded.email;

      if(email !== decodedEmail)
      {
        return res.status(401).send({error: true, message: 'forbidden access'})
      }
      const filter = { useremail: email }
      const result = await enrollCollecton.find(filter).toArray();
      res.send(result)
    })

    // delete seleted itams

    app.delete("/selecteditemsdelete/:id", async(req, res)=>
    {
      const id = req.params.id;
      const quary = {_id: new ObjectId(id)};
     

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await userCollecton.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await userCollecton.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })


    // Clint secrect

    app.post('/create-payment-intent', verifyJWT, async(req, res)=>{
      const {price} = req.body;
      if(price)
      {
        const amount = parseFloat(price) * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ['card']
        });
        res.send({client: paymentIntent.client_secret})
      }
    })


    // payment save in DB
    app.post("/payments", async(req, res)=>
    {
      const payment = req.body;
      const paymentClass = await paymentCollecton.findOne({classId: payment.classId})
      let result;
      if(!paymentClass?._id)
      {
        result= await paymentCollecton.insertOne({...payment, count: 1})
        
      }
      else
      {
         result = await paymentCollecton.updateOne({classId: payment.classId}, {$set: {count: paymentClass.count + 1}});

      }
      

      
      const selectedClass = await classCollecton.findOne({_id: new ObjectId( payment.classId)});
      const updateClass = await classCollecton.updateOne({_id: new ObjectId(payment.classId)}, {$set: {seats: selectedClass?.seats - 1}})

      res.send(result)

    })

    app.get('/myenrollclasses', async(req, res)=>
    {
      const { email } = req.query;
      console.log(email)
      const filter = { useremail: email }
      const result = await paymentCollecton.find(filter).toArray()
      res.send(result)

    })

    app.get("/popular", async(req, res)=>
    {
      
      const result = (await paymentCollecton.find({}).sort({count: -1}).toArray()).slice(0,6)

      console.log(result);
      res.send(result)
    })

    // app.get("/popular", async(req, res)=>
    // {
      
    //   const result = await paymentCollecton.find({}).sort({count: -1}).toArray()

    //   console.log(result);
    //   res.send(result)
    // })
    



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello Server')
})
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})