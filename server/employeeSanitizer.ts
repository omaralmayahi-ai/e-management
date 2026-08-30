import type { Employee } from "@shared/schema";

export type SafeEmployee = Omit<Employee, "passwordHash">;

export function sanitizeEmployee<T extends Partial<Employee> | null | undefined>(
  employee: T
): T extends null | undefined ? null : SafeEmployee {
  if (!employee) return null as any;
  const { passwordHash: _hash, ...safe } = employee as any;
  return safe;
}

export function sanitizeEmployees<T extends Partial<Employee>>(
  employeesList: T[]
): SafeEmployee[] {
  if (!Array.isArray(employeesList)) return [];
  return employeesList.map(e => sanitizeEmployee(e));
}
