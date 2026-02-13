import { z } from "zod";

export const loginSchema = z.object({
  employeeCode: z.string().min(1).max(8),
});

export const transactionSchema = z.object({
  drinkId: z.number().int().positive(),
  quantity: z.number().int().min(1),
  type: z.enum(["takeout", "return"]).optional().default("takeout"),
  customerName: z.string().optional(),
});

export const stockEntrySchema = z.object({
  drinkId: z.number().int().positive(),
  quantity: z.number().int().min(1),
});

export const inventoryCheckSchema = z.object({
  checks: z.array(
    z.object({
      drinkId: z.number().int().positive(),
      actualStock: z.number().int().min(0),
    })
  ),
});

export const drinkSchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().optional(),
  stock: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const employeeSchema = z.object({
  employeeCode: z.string().min(1).max(8),
  name: z.string().min(1).max(100),
  role: z.enum(["admin", "user"]).optional(),
});

export const settingsSchema = z.record(z.string(), z.string());
