import { Injectable, NotFoundException } from '@nestjs/common';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

@Injectable()
export class PermissionsService {
  private collectionName = 'Permissions';

  async getAll() {
    const { db } = await connectToDatabase();
    return await db.collection(this.collectionName).find({}).sort({ order: 1 }).toArray();
  }

  async getById(id: string) {
    const { db } = await connectToDatabase();
    return await db.collection(this.collectionName).findOne({ _id: new ObjectId(id) });
  }

  async create(data: { name: string; description?: string; order?: number; permissions?: string[] }) {
    const { db } = await connectToDatabase();
    const newGroup = {
      name: data.name,
      description: data.description || '',
      order: Number(data.order) || 1,
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      createdAt: new Date(),
    };
    const result = await db.collection(this.collectionName).insertOne(newGroup);
    return { _id: result.insertedId, ...newGroup };
  }

  async update(id: string, data: any) {
    const { db } = await connectToDatabase();
    const updateDoc: any = {};

    if (data.name !== undefined) updateDoc.name = data.name;
    if (data.description !== undefined) updateDoc.description = data.description;
    if (data.order !== undefined) updateDoc.order = Number(data.order);
    if (data.permissions !== undefined) updateDoc.permissions = Array.isArray(data.permissions) ? data.permissions : [];

    const result = await db.collection(this.collectionName).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );
    return result;
  }

  async delete(id: string) {
    const { db } = await connectToDatabase();
    return await db.collection(this.collectionName).deleteOne({ _id: new ObjectId(id) });
  }
}