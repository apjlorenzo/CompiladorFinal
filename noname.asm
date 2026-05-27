section .data
    fmt_int db "%d", 10, 0
    fmt_float db "%f", 10, 0
    fmt_str db "%s", 10, 0
    msg_div_zero db "Error de ejecucion: division por cero", 10, 0
    __flt_zero dq 0.0
    fmt_nl db 10, 0
    msg_1 db "hola", 10, 0
    msg_2 db "zzz", 10, 0
section .bss
    __float_print_tmp resq 1
extern printf
extern fflush
section .text
global main
main:
    push rbp
    mov rbp, rsp
    sub rsp, 48  ; locales y shadow space Win64
    mov eax, 15
    mov  dword [rbp - 4], eax  ; guardar int en pila
    mov eax, [rbp - 4]
    push   rax
    mov eax, 20
    mov    r10d, eax
    pop    rax
    cmp    eax, r10d
    setg  al
    movzx  eax, al
    cmp eax, 0
    je  if_else_1
    lea rcx, [rel msg_1]
    call printf
    xor ecx, ecx
    call fflush
    jmp if_fin_1
if_else_1:
    lea rcx, [rel msg_2]
    call printf
    xor ecx, ecx
    call fflush
if_fin_1:
    mov eax, 0  ; valor de retorno en eax
    mov rsp, rbp
    pop rbp
    ret