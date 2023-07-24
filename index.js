const express = require('express')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const bodyParser = require('body-parser')
const multer = require('multer')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const app = express()
const port = 3000

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors())
app.use('/img', express.static(path.join(__dirname, 'img')))

// MongoDB connection
mongoose
  .connect(
    'mongodb+srv://septaparas155:1234567890@paras.cru3gcl.mongodb.net/?retryWrites=true&w=majority',
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  )
  .then(() => {
    console.log('Connected to MongoDB')
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error)
  })

// Define user schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
  },
})

// Define product schema
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  image: {
    type: String,
  },
  path: {
    type: String,
    required: true,
    unique: true,
  },
})

const User = mongoose.model('accounts', userSchema, 'accounts')
const Product = mongoose.model('Product', productSchema)

// Middleware
app.use(express.json())

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'img/')
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const fileName = `${Date.now().toString(36)}${ext}`
    cb(null, fileName)
  },
})

const upload = multer({ storage: storage })

// Register endpoint
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body
    const hashedPassword = await bcrypt.hash(password, 10)

    const user = new User({ email, password: hashedPassword })
    await user.save()

    res.status(201).json({ message: 'User registered successfully' })
  } catch (error) {
    console.error('Error registering user:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, 'secret-key')

    res.json({
      token,
      account: user,
    })
  } catch (error) {
    console.error('Error logging in:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})


// Create a product
app.post('/api/products', upload.single('Image'), async (req, res) => {
  try {
    const { name, quantity, price } = req.body
    const image = req.file

    if (!name || !quantity || !price) {
      return res.status(400).json({ error: 'Incomplete product information' })
    } else {
      const newProduct = new Product({
        name,
        quantity: parseInt(quantity),
        price: parseFloat(price),
      })

      if (image) {
        const fileName = image.filename
        const publicPath = `/img/${fileName}`

        newProduct.image = fileName
        newProduct.path = publicPath
      }

      await newProduct.save()

      console.log('Product saved successfully')
      res.status(201).json({
        message: 'Product uploaded successfully',
        path: newProduct.path,
      })
    }
  } catch (err) {
    // Delete the image file if it was saved but the product save failed
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }

    console.error('Error saving product to MongoDB:', err)
    res.status(500).json({ message: 'Failed to save the product' })
  }
})

// Read all products
app.get('/api/products', async (req, res) => {
  const products = await Product.find({})
  try {
    res.status(200).json({
      products
    })
  } catch (error) {
    res.status(400).json({
      message: 'Product Not Found',
    })
  }
})

// Read a single product by ID
app.get('/api/products/:id', async (req, res) => {
  const productId = req.params.id
  try {
    let product = await Product.findById(productId)
    res.status(200).json({
      product,
    })
  } catch (error) {
    res.status(400).json({
      message: 'Product With ' + productId + ' Not Found',
    })
  }
})

// Update a product
app.put('/api/products/:id', upload.single('productImage'), async (req, res) => {
  try {
    const productId = req.params.id
    const { name, quantity, price } = req.body
    const image = req.file ? req.file.originalname : null

    const product = await Product.findByIdAndUpdate(
      productId,
      { name, quantity, price, image },
      { new: true },
    )

    if (product) {
      res.json(product)
    } else {
      res.status(404).json({ message: 'Product not found' })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to update the product' })
  }
})

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id

    const deletedProduct = await Product.findByIdAndRemove(productId)

    if (deletedProduct) {
      // Delete the image file from the "img" folder if it exists
      if (deletedProduct.image) {
        const imagePath = path.join(__dirname, 'img', deletedProduct.image)
        fs.unlink(imagePath, (unlinkError) => {
          if (unlinkError) {
            console.error(unlinkError)
          } else {
            console.log('Image file deleted successfully')
          }
        })
      }
      res.json({ message: 'Product deleted successfully' })
    } else {
      res.status(404).json({ message: 'Product not found' })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to delete the product' })
  }
})

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`)
})
