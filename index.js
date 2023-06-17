const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_KEY);

const app = express();
const cors = require('cors')
const port = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Mongodb platform running')
})
// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.9y7gcsu.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);
// console.log(uri);

// async await

async function run() {
  try {
    const Categories = client.db("products-resale").collection("category-products");
    const productCollection = client.db("products-resale").collection("products");
    const usersCollection = client.db("products-resale").collection("users");
    const OrdersCollection = client.db("products-resale").collection("orders");
    const Reports = client.db("products-resale").collection("reports");
    const paymentsCollection = client.db("products-resale").collection("payments");

    /* =========================
 * Verify Admin, Seller and Buyer Middleware
  =========================*/

    async function verifyAdmin(req, res, next) {
      const decodedEmail = req.decoded?.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
      }

      next();
    }
    async function verifySeller(req, res, next) {
      const requester = req.decoded?.email;
      const requesterInfo = await usersCollection.findOne({ email: requester })
      const requesterRole = requesterInfo?.role
      // console.log(`requesterRole `, requesterRole)
      if (!requesterInfo?.role === 'seller') {
        return res.status(401).send({
          message: `You are not seller`,
          status: 401
        })
      }
      next();
    }
    async function verifyBuyer(req, res, next) {
      const requester = req.decoded?.email;
      const requesterInfo = await usersCollection.findOne({ email: requester })
      const requesterRole = requesterInfo?.role
      // console.log(`requesterRole `, requesterRole)
      if (!requesterInfo?.role === 'buyer') {
        return res.status(401).send({
          message: `You are not Buyer`,
          status: 401
        })
      }
      next();
    }

    /* =========================
    * Check Admin and Seller Api Endpoint
     =========================*/
    // Check Admin
    app.get('/users/admin/:email', async (req, res) => {
      try {
        const userEmail = req.params.email
        const user = await usersCollection.findOne({ email: userEmail })
        res.send({
          success: true,
          message: 'Successfully get the Admin',
          isAdmin: user?.role === 'admin'
        })
      } catch (error) {
        res.send({
          success: false,
          error: error.message
        })
      }
    })
    // Check Seller
    app.get('/users/seller/:email', async (req, res) => {
      try {
        const userEmail = req.params.email
        const user = await usersCollection.findOne({ email: userEmail })
        res.send({
          success: true,
          message: 'Successfully get the Seller',
          isSeller: user?.role === 'seller'
        })
      } catch (error) {
        res.send({
          success: false,
          error: error.message
        })
      }
    })
    // Check Buyer
    app.get('/users/buyer/:email', async (req, res) => {
      try {
        const userEmail = req.params.email
        const user = await usersCollection.findOne({ email: userEmail })
        res.send({
          success: true,
          message: 'Successfully get the Buyer',
          isBuyer: user?.role === 'buyer'
        })
      } catch (error) {
        res.send({
          success: false,
          error: error.message
        })
      }
    })

    /* =========================
    * User Create and Verify Status Update Api Endpoint
     =========================*/
    // User Create Api Endpoint

    app.get('/users', async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.post('/users', async (req, res) => {
      try {
        const user = req.body
        const alreadyHave = await usersCollection.findOne({ email: user.email })
        if (!alreadyHave) {
          const users = await usersCollection.insertOne(user)
          res.send({
            success: true,
            message: 'Successfully create a new users',
            data: users
          })
        }
      } catch (error) {
        res.send({
          success: false,
          error: error.message
        })
      }
    })
    app.put('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    });
    // User verified status update
    app.put('/users/status-update/:email', verifyAdmin, async (req, res) => {
      try {
        const email = req.params.email
        const userFilter = { userEmail: email }
        const userFilter2 = { email: email }
        const option = { upsert: true }
        const updateDoc = {
          $set: {
            verify: true
          }
        }
        const productHae = await productCollection.find(userFilter).toArray()
        if (productHae.length) {
          const setVerify = await productCollection.updateMany(userFilter, updateDoc, option)
        }
        const users = await usersCollection.updateOne(userFilter2, updateDoc, option)
        res.send({
          success: true,
          message: 'Successfully change the user role',
          data: users
        })
      } catch (error) {
        res.send({
          success: false,
          error: error.message
        })
      }
    })

    /* =========================
    * All Product Api Endpoint
     =========================*/
    // Post
    app.post('/products', verifySeller, async (req, res) => {
      const ordersData = req.body
      const orders = await productCollection.insertOne(ordersData)
      res.send(orders);
    })
    // All Product get api with email in 

    app.get('/products', verifyBuyer, async (req, res) => {
      try {
        const email = req.query.email
        const products = await productCollection.find({ userEmail: email }, {}).toArray()
        res.send({
          success: true,
          message: 'Successfully add a new product',
          data: products
        })
      } catch (error) {
        res.send({
          success: false,
          error: error.message
        })
      }
    })

    // All product show in Product Page
    app.get('/allProducts', async (req, res) => {
      try {
        const products = await productCollection.find({}).toArray()
        const soldProduct = products.filter(product => product.status === 'sold')
        const filterProduct = products.filter(product => !soldProduct.includes(product))
        res.send({
          success: true,
          message: 'Successfully add a new product',
          data: filterProduct
        })
      } catch (error) {
        res.send({
          success: false,
          error: error.message
        })
      }
    })

    // Product Delete Api
    app.delete('/products/:productId', verifySeller, async (req, res) => {
      try {
        const productId = req.params.productId
        const products = await productCollection.deleteOne({ _id: ObjectId(productId) })
        res.send({
          success: true,
          message: 'Product deleted successfully',
          data: products
        })
      } catch (error) {
        res.send({
          success: false,
          error: error.message
        })
      }
    })

    /* =========================
    * All Reported Product Api Endpoint
     =========================*/
    // Reported Product Api
    app.post('/reports', verifyBuyer, async (req, res) => {
      try {
        const reportsProduct = req.body
        const reportsProducts = await Reports.insertOne(reportsProduct)

        const productId = reportsProduct.productId
        const filterProduct = { _id: ObjectId(productId) }
        const productUpdatedDoc = {
          $set: {
            reported: true
          }
        }
        const updateReportedStatus = await productCollection.updateOne(filterProduct, productUpdatedDoc)
        res.send(reportsProducts)
      } catch (error) {
        res.send({
          success: false,
          error: error.message
        })
      }
    })
    // Reported product get
    app.get('/reports', async (req, res) => {
      try {
        const reportedProducts = await Reports.find({}).toArray()
        res.send({
          success: true,
          message: 'Successfully all reported product loaded!',
          data: reportedProducts
        })
      } catch (error) {
        res.send({
          success: false,
          error: error.message
        })
      }
    })
    app.get('/reports', async (req, res) => {
      console.log(req.query.email);
      let query = {};
      if (req.query.email) {
        query = {
          email: req.query.email
        }
      }
      const cursor = Reports.find(query);
      const orders = await cursor.toArray();
      res.send(orders);
    })
    app.get('/reports/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const booking = await Reports.findOne(query);
      res.send(booking);
    })
    // Reported product deleted

    app.delete('/reports/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await Reports.deleteOne(filter);
      res.send(result);
    })


    /* =========================
    * All Category Api Endpoint
     =========================*/
    // Add Category Api

    app.post('/category', verifySeller, async (req, res) => {
      const categoryData = req.body
      const category = await Categories.insertOne(categoryData)
      res.send(category);

    })
    // All Product Category get api

    app.get('/category', async (req, res) => {
      const categories = await Categories.find({}).toArray()
      res.send(categories)
    })

    app.get('/category/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const booking = await Categories.findOne(query);
      res.send(booking);
    })

    // Category Delete

    app.delete('/category/:categoryId', verifySeller, async (req, res) => {
      const categoryId = req.params.categoryId;
      const categories = await Categories.deleteOne({ _id: ObjectId(categoryId) })
      res.send(categories);
    })

    /* =========================
    * All Order Api Endpoint
     =========================*/

    app.get('/orders',  verifyBuyer, async (req, res) => {
      console.log(req.query.email);
      let query = {};
      if (req.query.email) {
        query = {
          email: req.query.email
        }
      }
      const cursor = OrdersCollection.find(query);
      const orders = await cursor.toArray();
      res.send(orders);
    })
    app.get('/orders/:id', verifyBuyer, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const booking = await OrdersCollection.findOne(query);
      res.send(booking);
    })

    app.post('/orders', verifyBuyer, async (req, res) => {
      const order = req.body;
      console.log(order);
      const result = await OrdersCollection.insertOne(order)
      res.send(result);
    })
    app.delete('/orders/:id', verifyBuyer, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await OrdersCollection.deleteOne(filter);
      res.send(result);
    })


    /* =========================
    * Buyer and Seller in Admin Dashboard Api Endpoint
     =========================*/
    // All Buyers Loaded
    app.get('/buyers', async (req, res) => {
        const buyers = await usersCollection.find({ role: 'buyer' }).toArray()
      res.send(buyers);
    })
    // Buyer Delete
    app.delete('/buyers/:buyerId', async (req, res) => {
        const buyerId = req.params.buyerId
        const users = await usersCollection.deleteOne({ _id: ObjectId(buyerId) })
      res.send(users);
    })
    // // All Sellers Loaded
    app.get('/sellers', async (req, res) => {
        const sellers = await usersCollection.find({ role: 'seller' }).toArray()
      res.send(sellers);
    })
    // Seller Delete
    app.delete('/sellers/:sellerId', async (req, res) => {
        const sellerId = req.params.sellerId
        const users = await usersCollection.deleteOne({ _id: ObjectId(sellerId) })
      res.send(users);
    })

    /* =========================
    * Stripe Payment Api Endpoint
     =========================*/
    // Stripe payment Implement

    app.post('/create-payment-intent',  verifyBuyer, async (req, res) => {
      const order = req.body
      const price = order.price
      const amount = price * 100
      const paymentIntent = await stripe.paymentIntents.create({
        currency: 'usd',
        amount: amount,
        "payment_method_types": [
          "card"
        ]
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });

    });

    // Save payments data in database

    app.post('/payments', verifyBuyer, async (req, res) => {
      const payment = req.body
      // console.log(req.body)
      const payments = await paymentsCollection.insertOne(payment)
      const id = payment.orderId
      const productId = payment.productId
      const filterOrder = { _id: ObjectId(id) }
      const filterProduct = { _id: ObjectId(productId) }

      const orderUpdatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }
      const productUpdatedDoc = {
        $set: {
          status: 'sold'
        }
      }
      const updatePayments = await OrdersCollection.updateOne(filterOrder, orderUpdatedDoc)
      const updateProductsStatus = await productCollection.updateOne(filterProduct, productUpdatedDoc)
      console.log(updatePayments, updateProductsStatus)
      res.send(payments)

    })

    /* =========================
    * All Advertisement Api Endpoint
     =========================*/
    
    app.put('/makeAdvertise/:productId', verifyBuyer, async (req, res) => {
      try {
        const productId = req.params.productId;
        const filter = {
          _id: ObjectId(productId)
        }
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            isAdvertise: true
          }
        };
        const products = await productCollection.updateOne(filter, updateDoc, options)
        res.send({
          success: true,
          message: 'Advertisement Done successfully',
          data: products
        })
      } catch (error) {
        res.send({
          success: false,
          error: error.message
        })
      }
    })
    // Make Advertisement get 
    app.get('/makeAdvertise', async (req, res) => {

      const products = await productCollection.find({ isAdvertise: true }).toArray()
      const soldProduct = products.filter(product => product.status === 'sold')
      const filterProduct = products.filter(product => !soldProduct.includes(product))
      res.send(filterProduct);
    })


  }
  finally {

  }
}

run().catch(err => console.log(err))

app.listen(port, () => {
  console.log(`simple node server running on port ${port}`);
}) 