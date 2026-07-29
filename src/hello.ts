/**
 * Тестовый модуль вывода "hello" в командную строку
 */
export function printHello(): void {
  console.log("hello");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  printHello();
} else {
  printHello();
}
