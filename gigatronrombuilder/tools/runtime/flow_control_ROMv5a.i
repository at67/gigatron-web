; do *NOT* use register4 to register7 during time slicing
realTimeAddr        EQU     register0
realTimeProc0       EQU     register1
realTimeProc1       EQU     register2
realTimeProc2       EQU     register3
numericLabel        EQU     register12
defaultLabel        EQU     register13
lutLabs             EQU     register14
lutAddrs            EQU     register15
lutIndex            EQU     register16
romUser             EQU     register0                       ; user requested romType
romType             EQU     register1                       ; actual romType
romReadAddr         EQU     register0
romErrAddr          EQU     0x7E                            ; loader happy constant address
vramErrAddr         EQU     0x0101

romErrAddr          DW      vramErrAddr


; can't use any new instructions in romCheck
%SUB                romCheck
romCheck            LD      giga_romType
                    ANDI    0xFC
                    STW     romType
                    SUBW    romUser
                    BEQ     romC_return                     ; romType = romUser, so ok
                    LDW     romUser
                    SUBI    0x80                            ; experimental ROM's must match exactly
                    BNE     romC_check
                    LDW     romType
                    SUBW    romUser
                    BEQ     romC_return                     ; romType = romUser, so ok
                    BRA     romC_fail

romC_check          LDW     romType                         ; non experimental ROM
                    SUBW    romUser
                    BGT     romC_return                     ; romType > romUser, so ok

romC_fail           LD      giga_rand0
                    POKE    romErrAddr                      ; random horizontal scroll
                    BRA     romC_fail

romC_return         RET
%ENDS

%SUB                romExec
romExec             STW     giga_vLR
                    LDI     SYS_Exec_88                     ; address < 0x0100 so use LDI
                    STW     giga_sysFn
                    SYS     88                              ; doesn't return from here!
%ENDS

%SUB                romRead
romRead             LDI     SYS_ReadRomDir_v5_80            ; address < 0x0100 so use LDI
                    STW     giga_sysFn
                    LDW     romReadAddr
                    SYS     80
                    RET
%ENDS

%SUB                getRomType
getRomType          LD      giga_romType
                    ANDI    0xFC
                    RET
%ENDS

%SUB                isRomTypeX
                    ; return zero if false, non zero if true
isRomTypeX          LD      giga_romType
                    ANDI    0x80
                    BEQ     isRomX_false
                    LD      giga_romType
                    SUBI    0xF0
                    BGE     isRomX_false
                    RET

isRomX_false        LDI     0
                    RET
%ENDS

%SUB                realTimeStub
                    ; runs real time, (vblank interrupt), code at regular intervals
                    ; self modifying code allows for timer, midi and user procs
realTimeStub        RET                                     ; RET gets replaced by PUSH
                    INC     timerJiff                       ; 1/60 internal counter
                    CALLI   0x0000                          ; 0x0000 gets replaced by realTimeProc0 address

realTimeStub1       BRA     realTS_rti
                    RET                                     ; BRA + RET gets replaced by CALLI realTimeProc1 address

realTimeStub2       BRA     realTS_rti
                    RET                                     ; BRA + RET gets replaced by CALLI realTimeProc2 address

realTS_rti          POP
                    LDI     255                             ; (256 - n) = vblank interrupt frequency
                    ST      giga_frameCount
                    LDWI    &h0400
                    LUP 0                                   ; RTI
%ENDS

%SUB                setRealTimeProc0
setRealTimeProc0    LDWI    realTimeStub
                    STW     realTimeAddr
                    LDI     0x75
                    POKE    realTimeAddr                    ; replace RET with PUSH
                    LDWI    realTimeStub + 4
                    STW     realTimeAddr
                    LDW     realTimeProc0
                    DOKE    realTimeAddr                    ; replace CALLI's operand, (0x0000), with proc
                    RET
%ENDS

%SUB                setRealTimeProc1
setRealTimeProc1    PUSH
                    CALLI   setRealTimeProc0
                    LDWI    realTimeStub1
                    STW     realTimeAddr
                    LDI     0x85
                    POKE    realTimeAddr                    ; replace BRA with CALLI
                    INC     realTimeAddr                    ; realTimeStub + 1
                    LDW     realTimeProc1
                    DOKE    realTimeAddr                    ; replace LBL + RET with proc
                    POP
                    RET
%ENDS

%SUB                setRealTimeProc2
setRealTimeProc2    PUSH
                    CALLI   setRealTimeProc1
                    LDWI    realTimeStub2
                    STW     realTimeAddr
                    LDI     0x85
                    POKE    realTimeAddr                    ; replace BRA with CALLI
                    INC     realTimeAddr                    ; realTimeStub + 1
                    LDW     realTimeProc2
                    DOKE    realTimeAddr                    ; replace LBL + RET with proc
                    POP
                    RET
%ENDS

%SUB                gotoNumericLabel
                    ; find numeric label and jump to it
gotoNumericLabel    LDWI    _lut_numericLabs
                    STW     lutLabs
                    STW     lutIndex
                    LDWI    _lut_numericAddrs
                    STW     lutAddrs

gotoNL_loop         LDW     lutIndex
                    DEEK
                    BNE     gotoNL_cont                     ; check for 0
                    LDW     defaultLabel
                    BEQ     gotoNL_exit
                    CALL    defaultLabel                    ; fetch default address and jump, (note we never return from here)

gotoNL_exit         RET

gotoNL_cont         SUBW    numericLabel
                    BEQ     gotoNL_found
                    INC     lutIndex
                    INC     lutIndex
                    BRA     gotoNL_loop                     ; loop through lut until found or 0

gotoNL_found        LDW     lutIndex
                    SUBW    lutLabs
                    ADDW    lutAddrs
                    DEEK
                    CALL    giga_vAC                        ; fetch label address and jump, (note we never return from here)
%ENDS

%SUB                gosubNumericLabel
                    ; find numeric label and call it, (it had better return or welcome to lala land)
gosubNumericLabel   PUSH
                    LDWI    _lut_numericLabs
                    STW     lutLabs
                    STW     lutIndex
                    LDWI    _lut_numericAddrs
                    STW     lutAddrs

gosubNL_loop        LDW     lutIndex
                    DEEK
                    BNE     gosubNL_cont                    ; check for 0
                    LDW     defaultLabel
                    BEQ     gosubNL_exit
                    CALL    defaultLabel                    ; fetch default address and call

gosubNL_exit        POP
                    RET

gosubNL_cont        SUBW    numericLabel
                    BEQ     gosubNL_found
                    INC     lutIndex
                    INC     lutIndex
                    BRA     gosubNL_loop                    ; loop through lut until found or 0

gosubNL_found       LDW     lutIndex
                    SUBW    lutLabs
                    ADDW    lutAddrs
                    DEEK
                    CALL    giga_vAC                        ; fetch label address and call
                    POP
                    RET
%ENDS
