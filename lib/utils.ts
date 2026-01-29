export const generateEmail = (studentId: string): string => {
  if (!studentId) return "";
  return `${studentId}@gm.uit.edu.vn`;
};

export const formatSlug = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};