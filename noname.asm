section .data
    fmt_int db "%d", 10, 0
    fmt_float db "%f", 10, 0
    fmt_str db "%s", 10, 0
    fmt_scanf db "%d", 0
    msg_div_zero db "Error de ejecucion: division por cero", 10, 0
    __flt_zero dq 0.0
    fmt_nl db 10, 0
    msg_1 db "holaaa", 0
section .bss
    __float_print_tmp resq 1
extern printf
extern scanf
extern fflush
section .text
global main
main:
    push rbp
    mov rbp, rsp
    sub rsp, 32  ; locales y shadow space Win64
    lea rcx, [rel msg_1]
    call printf
    xor ecx, ecx
    call fflush
    mov eax, 0  ; valor de retorno en eax
    mov rsp, rbp
    pop rbp
    ret