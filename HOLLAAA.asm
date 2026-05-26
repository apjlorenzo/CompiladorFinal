section .data
    fmt_int db "%d", 10, 0
    fmt_float db "%f", 10, 0
    fmt_str db "%s", 10, 0
    msg_div_zero db "Error de ejecucion: division por cero", 10, 0
    __flt_zero dq 0.0
    fmt_nl db 10, 0
    str_lit_13 db "%d", 10, 0
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
    mov eax, 1
    mov  dword [rbp - 4], eax  ; guardar int en pila
while_ini_2:
    mov eax, [rbp - 4]
    push   rax
    mov eax, 3
    mov    r10d, eax
    pop    rax
    cmp    eax, r10d
    setle  al
    movzx  eax, al
    cmp eax, 0
    je  while_fin_2
    mov eax, [rbp - 4]
    mov edx, eax
    lea rcx, [rel str_lit_13]
    xor eax, eax
    call printf
    xor ecx, ecx
    call fflush
    jmp while_ini_2
while_fin_2:
    mov eax, 0  ; valor de retorno en eax
    mov rsp, rbp
    pop rbp
    ret