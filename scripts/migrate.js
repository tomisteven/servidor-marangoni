require('dotenv').config();
const mongoose = require('mongoose');

// Usar variables de entorno para seguridad
const LOCAL_URI = process.env.MONGO_URI_LOCAL || 'mongodb://localhost:27017/torneos-marangoni';
const ATLAS_URI = process.env.MONGO_URI;

async function migrate() {
  console.log('🚀 Iniciando migración de datos...');

  try {
    // 1. Conectar a la base de datos local
    const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
    console.log('✅ Conectado a MongoDB Local');

    // 2. Conectar a MongoDB Atlas
    const atlasConn = await mongoose.createConnection(ATLAS_URI).asPromise();
    console.log('✅ Conectado a MongoDB Atlas');

    // 3. Obtener todas las colecciones de la base local
    const collections = await localConn.db.listCollections().toArray();
    console.log(`📦 Encontradas ${collections.length} colecciones`);

    for (const colDef of collections) {
      const colName = colDef.name;
      console.log(`\n--- Procesando colección: ${colName} ---`);

      const localCollection = localConn.db.collection(colName);
      const atlasCollection = atlasConn.db.collection(colName);

      // Limpiar la colección de destino primero (opcional, pero asegura réplica exacta)
      await atlasCollection.deleteMany({});
      console.log(`🗑️  Limpiada colección '${colName}' en Atlas`);

      // Obtener todos los documentos
      const documents = await localCollection.find({}).toArray();
      
      if (documents.length > 0) {
        console.log(`📤 Insertando ${documents.length} documentos en Atlas...`);
        await atlasCollection.insertMany(documents);
        console.log(`✅ Colección '${colName}' migrada con éxito`);
      } else {
        console.log(`ℹ️  Colección '${colName}' está vacía, saltando...`);
      }
    }

    console.log('\n✨ Migración completada con éxito!');
    
    await localConn.close();
    await atlasConn.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    process.exit(1);
  }
}

migrate();
