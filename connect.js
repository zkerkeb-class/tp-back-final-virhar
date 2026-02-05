import mongoose from 'mongoose';

// Connexion à MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/pokemon_database');
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

connectDB();