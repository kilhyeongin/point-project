import mongoose, { Schema, model, models } from "mongoose";

const OrganizationSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Organization = models.Organization || model("Organization", OrganizationSchema);
