from tqdm import tqdm
import random
import math
from datetime import datetime

from StorageD.tools import BaseTools as bt
from StorageD.tools import CodecException
from StorageD.rules import RULES_COUNT,ALL_RULES

import logging
log = logging.getLogger('mylog')

class Wukong():
    def __init__(self, rule_num=0, window=150, moving=140):
        """
        Wukong codec algorithm
        @param rule_num: the codec rule used in codec
        @param window:
        @param moving:
        """
        if rule_num < 0 or rule_num > RULES_COUNT:
            err = 'dict num {} out of index, max: {}'.format(rule_num, RULES_COUNT)
            log.error(err)
            raise CodecException(err)
        self.dictji = ALL_RULES[rule_num][0]
        self.dictou = ALL_RULES[rule_num][1]
        self.reverse_dictji = bt.creat_reverse_dict(self.dictji)
        self.reverse_dictou = bt.creat_reverse_dict(self.dictou)

        if window<100: log.warning("window is too small, reset to : {}".format(100))
        if moving<90: log.warning("moving is too small, reset to: {}".format(90))
        self._window = window if window>=100 else 100
        self._moving = moving if moving>=90 else 90
        #create virtual segments by random as default. 
        #when random section timeout, this value will be reset to True.
        self.virtual_timeout = 20 #20 seconds
        self._create_virtual_by_function = False
        self.progress = 0.0

    def __check_encode_param(self):
        if self.bin_split_length % 2 != 0:
            raise CodecException("sequence length need to be even")

    def wukong_encode(self,index_length, bit_segments, max_homopolymer, max_content,
                min_content, max_iterations=30, hasseed=True, seed=27):
        self.index_length = index_length
        self.max_homopolymer = max_homopolymer
        self.max_content = max_content
        self.min_content = min_content
        self.max_iterations = max_iterations
        self.has_seed = hasseed
        self.seed = seed
        self.bin_split_length = len(bit_segments[0])
        self.total_count = len(bit_segments)
        self.__check_encode_param()
        if self.has_seed:
            random.seed(self.seed)  
        else:
            random.seed()
        self._enable_index = random.sample(list(range(self.total_count)), self.total_count) # get random indexs

        pro_bar = tqdm(total=len(bit_segments), desc="Encoding")
        res_dna_seq = []
        while(len(self._enable_index)>0):
            # try to encode
            start_num = len(self._enable_index)
            is_succeed = False
            first_enable_index = -1
            first_index = self._enable_index[first_enable_index]
            for iter_num in range(self.max_iterations):
                # When only one remains, add the virtual fragment directly
                if len(self._enable_index)==1:
                    break
                # When try all other segments, add the virtual fragment directly
                if 2+iter_num > len(self._enable_index):
                    break
                # choose last two random indexs
                encode_bin_segments = [bit_segments[first_index]]
                second_enable_index = -2-iter_num
                second_index = self._enable_index[second_enable_index]
                encode_bin_segments.append(bit_segments[second_index])

                binstr = self._assem_multi_to_one(encode_bin_segments)
                dnaseq = self._jiouencode(binstr)

                if self._check_segment(dnaseq):
                    is_succeed = True
                    res_dna_seq.append(dnaseq)
                    # pop last two random indexs
                    self._enable_index.pop(second_enable_index)
                    self._enable_index.pop()
                    break
            # If the encoding failed, add a virtual segment
            if not is_succeed:
                res_dna_seq.append(self._addtion_improve(bit_segments))
            pro_bar.update(start_num - len(self._enable_index))
            self.progress = (self.total_count-len(self._enable_index)) / self.total_count
        pro_bar.close()
        self.addtion_num = len(res_dna_seq)*2 - self.total_count
        log.debug("There are " + str(self.addtion_num)
                + " random bit segment(s) adding for reliability.")
        return res_dna_seq

    def wukong_decode(self,dna_segments):
        bit_segments = []
        pro_bar = tqdm(total=len(dna_segments), desc="Decoding")
        for dna_sequence in dna_segments:
            bit_seg_1, bit_seg_2 = self._jioudecode(dna_sequence)
            bit_segments.append(bit_seg_1)
            bit_segments.append(bit_seg_2)
            pro_bar.update()
            self.progress = int(len(bit_segments)/2) / len(dna_segments)
        pro_bar.close()
        return  bit_segments

    def _assem_multi_to_one(self, bin_str_list):
        res = ''
        if type(bin_str_list)!=list:
            raise CodecException("Type error, need list but {}".format(type(bin_str_list)))
        if len(bin_str_list) != 2:
            raise CodecException("Error, the sequence number should be 2, now: {}".format(len(bin_str_list)))
        # Compares the sequence length
        bin_len_list = [len(x) for x in bin_str_list]
        if min(bin_len_list)!=max(bin_len_list):
            raise CodecException("Error, two assembled, but the length is not consistent!")
        str_len = len(bin_str_list[0])
        if str_len%2!=0:
            raise CodecException("Error, length of bin_str should be even")
        for i in range(0,str_len,2):
            res += bin_str_list[0][i] + bin_str_list[1][i] + bin_str_list[1][i + 1] + bin_str_list[0][i + 1]
        return res

    def _jiouencode(self, binstr):
        slen = len(binstr)
        remainder = slen%8
        res = ''.join([self.dictji[binstr[i:i+4]]+self.dictou[binstr[i+4:i+8]] for i in range(0,slen-remainder,8)])
        if remainder==0:
            pass
        elif remainder==4:
            res += self.dictji[binstr[-remainder:]]
        else:
            raise CodecException("Wrong length to encode")
        return res

    def _jioudecode(self, dna_sequence):
        dna_len = len(dna_sequence)
        if dna_len%2!=0:
            raise CodecException("The DNA sequence length is incorrect，needs to be an even number")
        remainder = dna_len%4
        bit_seg = ''.join([self.reverse_dictji[dna_sequence[i:i+2]]+self.reverse_dictou[dna_sequence[i+2:i+4]] for i in range(0, dna_len-remainder, 4)])
        if remainder!=0:
            bit_seg += self.reverse_dictji[dna_sequence[-remainder:]]
        bit_len = len(bit_seg)
        bit_seg_1 = "".join([bit_seg[i]+bit_seg[i+3] for i in range(0, bit_len, 4)])
        bit_seg_2 = "".join([bit_seg[i+1] + bit_seg[i+2] for i in range(0, bit_len, 4)])
        return bit_seg_1,bit_seg_2


    def _check_segment(self, dnastr):
        for index in range(0,len(dnastr), self._moving):
            last = index+self._window
            if last>=len(dnastr):
                last=None
            check_str = dnastr[index:last]
            if bt.get_repeat(check_str) > self.max_homopolymer:
                # log.debug("homopolymer false: {} - {}:{}".format(index,last,check_str))
                return False
            gc_content = bt.get_gc(check_str)
            if gc_content < self.min_content or gc_content > self.max_content:
                # log.debug("gc false: {} - {}:{}".format(index,last,check_str))
                return False
        return True

    def _get_virtual_segment(self, bit_segment):
        #TODO: better to generate a new segment
        split_seg = [bit_segment[i:i+2] for i in range(0,len(bit_segment),2)]
        for start in ['0','1']:
            is_ji = True
            first_bin = split_seg[0][0] + '1' + start + split_seg[0][1]
            res_base = self.dictji[first_bin]
            for seg in split_seg[1:]:
                is_ji = not is_ji
                tmp_base_list = list()
                gc_delta_list = list()
                for tmp1 in ['0','1']:
                    for tmp2 in ['0','1']:
                        tmp_bin = seg[0] + tmp1 + tmp2 + seg[1]
                        tmp_base = self.dictji[tmp_bin] if is_ji else self.dictou[tmp_bin]
                        check_str = res_base + tmp_base
                        if len(check_str)>=self.max_homopolymer:
                            if bt.check_equal(check_str[-self.max_homopolymer:]): # if homopolymer does not meet requirement, do not add in list
                                break
                        tmp_base_list.append(tmp_base)
                        gc_delta_list.append(abs((self.max_content+self.min_content)/2 - bt.get_gc(check_str)))
                if len(tmp_base_list)==0: # all segments's homopolymer do not meet requirement
                    raise CodecException("Could not get virtual segment.\nConsider encoding with more relaxed conditions.")
                else:
                    no_repeat_bases = list()
                    min_gc = 1
                    res = ""
                    # Priority is given to non-repetition
                    for index, bases in enumerate(tmp_base_list):
                        if bases[0]!=bases[1]: # Use data with GC content closing to 0.5
                            if gc_delta_list[index] < min_gc:
                                min_gc = gc_delta_list[index]
                                res = bases
                    if res == "":
                        res = tmp_base_list[gc_delta_list.index(min(gc_delta_list))]
                    res_base += tmp_base_list[gc_delta_list.index(min(gc_delta_list))]
        return res_base

    def _addtion_improve(self, bit_segments):
        
        bit_segment = bit_segments[self._enable_index[-1]]
        
        # create virtual by random as default
        if not self._create_virtual_by_function:
            encode_bin_seg = []
            encode_bin_seg.append(bit_segment)
            tm_start = datetime.now()
            while True:
                if (datetime.now() - tm_start).seconds > self.virtual_timeout:
                    log.debug("Get random virtual segments timeout. Change create mode, and this will continue till the end of encoding")
                    self._create_virtual_by_function = True # Timeout. Change create mode, and this will continue till the end of encoding
                    break
                
                # generate a virtual segment with an index first of 1
                random_index = random.randint(math.pow(2, self.index_length - 1), math.pow(2, self.index_length) - 1)
                created_bin = bin(random_index)[2:]
                for i in range(self.bin_split_length - self.index_length):
                    created_bin += str(random.randrange(0, 2))
    
                encode_bin_seg.append(created_bin)
                binstr = self._assem_multi_to_one(encode_bin_seg)
                dnaseq = self._jiouencode(binstr)
    
                if self._check_segment(dnaseq):
                    self._enable_index.pop()
                    return dnaseq
                else:
                    encode_bin_seg.pop() # If the combination is not available, delete the imaginary fragment and continue looking
        
        # create virtual by function: self._get_virtual_segment(bit_segment)
        if self._create_virtual_by_function:
            dnaseq = self._get_virtual_segment(bit_segment)
            if not self._check_segment(dnaseq):
                raise CodecException("Virtual segment error.\nConsider encoding with more relaxed parameter")
            self._enable_index.pop()
            return dnaseq
